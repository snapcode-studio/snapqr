import { listenAuthState, logOut } from './auth';
import { addMenuItem, deleteMenuItem, listenToMenu, updateMenuOrder, saveTheme, listenToTheme } from './db';
import Sortable from 'sortablejs';
import QRCodeStyling from 'qr-code-styling';
import html2canvas from 'html2canvas';
import { db } from './firebase-config';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// ── Slug Utils (inline) ───────────────────────────────────────────
const SLUG_REGEX = /^[a-z0-9-]{3,30}$/;
const SLUG_COOLDOWN_H = 24;

async function checkMenuSlugAvailable(slug, uid) {
  const snap = await getDoc(doc(db, 'menuSlugs', slug));
  if (!snap.exists()) return { available: true };
  return snap.data().uid === uid ? { available: false, isOwn: true } : { available: false, isOwn: false };
}

async function claimMenuSlug(uid, newSlug, oldSlug, lastChange) {
  if (lastChange) {
    const diffH = (Date.now() - new Date(lastChange).getTime()) / 3600000;
    if (diffH < SLUG_COOLDOWN_H) throw new Error(`Zmień ponownie za ${Math.ceil(SLUG_COOLDOWN_H - diffH)}h.`);
  }
  if (oldSlug && oldSlug !== newSlug) { try { await deleteDoc(doc(db, 'menuSlugs', oldSlug)); } catch {} }
  await setDoc(doc(db, 'menuSlugs', newSlug), { uid, claimedAt: new Date().toISOString() });
  await setDoc(doc(db, 'users', uid, 'settings', 'slug'), { slug: newSlug, lastChange: new Date().toISOString() }, { merge: true });
}

const logoutBtn = document.getElementById('logoutBtn');
const dashboardContent = document.getElementById('dashboardContent');
const qrcodeWrapper = document.getElementById('qrcodeWrapper');
const qrcodeContainer = document.getElementById('qrcode');
const publicLink = document.getElementById('publicLink');
const downloadQrBtn = document.getElementById('downloadQrBtn');

// Widget Modal UI
const openWidgetModalBtn = document.getElementById('openWidgetModalBtn');
const widgetModal = document.getElementById('widgetModal');
const closeWidgetModalBtn = document.getElementById('closeWidgetModalBtn');
const widgetCodeInput = document.getElementById('widgetCodeInput');
const copyWidgetCodeBtn = document.getElementById('copyWidgetCodeBtn');
const copyWidgetLinkBtn = document.getElementById('copyWidgetLinkBtn');
const widgetPreviewIframe = document.getElementById('widgetPreviewIframe');

// Menu UI
const addItemForm = document.getElementById('addItemForm');
const itemNameInput = document.getElementById('itemName');
const itemDescInput = document.getElementById('itemDesc');
const itemPriceInput = document.getElementById('itemPrice');
const menuList = document.getElementById('menuList');
const addItemBtn = document.getElementById('addItemBtn');

// Theme UI
const restaurantNameInput = document.getElementById('restaurantNameInput');
const bgSwatches = document.querySelectorAll('#bgSwatches .swatch');
const fontSwatches = document.querySelectorAll('#fontSwatches .swatch');

let currentUser = null;
let currentItemsCount = 0;
let unsubscribeMenu = null;
let unsubscribeTheme = null;
let qrCode = null;

let currentTheme = {
  bgColor: '#000000',
  textColor: '#ffffff',
  fontFamily: "'Inter', sans-serif",
  restaurantName: "Nasze Menu"
};

listenAuthState((user) => {
  if (user) {
    currentUser = user;
    dashboardContent.style.display = 'grid';

    // ── Slug Editor ──────────────────────────────────────────────────
    const slugInput = document.getElementById('slugInput');
    const slugConfirmBtn = document.getElementById('slugConfirmBtn');
    const slugMsg = document.getElementById('slugMsg');
    let slugTimer = null;
    let currentSlug = null;
    let lastSlugChange = null;

    // Load existing slug
    getDoc(doc(db, 'users', user.uid, 'settings', 'slug')).then(snap => {
      if (snap.exists()) {
        currentSlug = snap.data().slug;
        lastSlugChange = snap.data().lastChange;
        slugInput.value = currentSlug;
        slugInput.style.borderColor = 'rgba(255,255,255,0.2)';
      }
    });

    slugInput.addEventListener('input', () => {
      const val = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      slugInput.value = val;
      slugConfirmBtn.style.display = 'none';
      if (slugTimer) clearTimeout(slugTimer);
      if (!val || val === currentSlug) { slugMsg.textContent = ''; slugInput.style.borderColor = ''; return; }
      if (!SLUG_REGEX.test(val)) {
        slugMsg.textContent = 'Min 3 znaki, tylko a-z, 0-9, myślnik.';
        slugMsg.style.color = '#ff453a';
        slugInput.style.borderColor = '#ff453a';
        return;
      }
      slugMsg.textContent = 'Sprawdzam...';
      slugMsg.style.color = 'var(--text-muted)';
      slugTimer = setTimeout(async () => {
        const res = await checkMenuSlugAvailable(val, user.uid);
        if (res.available) {
          slugMsg.textContent = '✓ Dostępny!';
          slugMsg.style.color = '#4ade80';
          slugInput.style.borderColor = '#4ade80';
          slugConfirmBtn.style.display = 'flex';
        } else {
          slugMsg.textContent = '✗ Zajęty.';
          slugMsg.style.color = '#ff453a';
          slugInput.style.borderColor = '#ff453a';
          slugConfirmBtn.style.display = 'none';
        }
      }, 600);
    });

    slugConfirmBtn.addEventListener('click', async () => {
      const val = slugInput.value;
      if (!SLUG_REGEX.test(val)) return;
      try {
        await claimMenuSlug(user.uid, val, currentSlug, lastSlugChange);
        currentSlug = val;
        lastSlugChange = new Date().toISOString();
        slugMsg.textContent = '✓ Zapisano! Twój link: menu.getsnap.space/m/' + val;
        slugMsg.style.color = '#4ade80';
        slugConfirmBtn.style.display = 'none';
        slugInput.style.borderColor = 'rgba(255,255,255,0.2)';
        // Update public link and QR
        const newUrl = `${window.location.origin}/menu.html?id=${user.uid}`;
        publicLink.href = newUrl;
      } catch(e) {
        slugMsg.textContent = e.message;
        slugMsg.style.color = '#ff453a';
      }
    });
    // ─────────────────────────────────────────────────────────────────

    const menuUrl = `${window.location.origin}/menu.html?id=${user.uid}`;
    publicLink.href = menuUrl;

    // Inicjalizacja Kodu QR a'la LinkedIn
    qrCode = new QRCodeStyling({
      width: 320,
      height: 320,
      data: menuUrl,
      image: "/favicon-96x96.png",
      dotsOptions: {
        color: "#0a0a0c",
        type: "rounded"
      },
      backgroundOptions: {
        color: "transparent", // Tło kontenera daje biały kolor, dzięki czemu sam QR można pobrać przezroczysty jak trzeba
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5,
        imageSize: 0.4 // Duże logo
      },
      cornersSquareOptions: {
        color: "#0a0a0c",
        type: "extra-rounded"
      },
      cornersDotOptions: {
        color: "#0a0a0c",
        type: "dot"
      }
    });
    qrcodeContainer.innerHTML = '';
    qrCode.append(qrcodeContainer);

    downloadQrBtn.onclick = async () => {
      const originalText = downloadQrBtn.innerText;
      downloadQrBtn.innerText = "Pobieranie...";
      downloadQrBtn.disabled = true;
      try {
        const canvas = await html2canvas(qrcodeWrapper, {
          backgroundColor: null,
          scale: 6, // High quality
          useCORS: true
        });
        const link = document.createElement('a');
        link.download = 'SnapMenu-QR.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error("Błąd generowania kodu QR: ", err);
        alert("Nie udało się pobrać kodu QR.");
      } finally {
        downloadQrBtn.innerText = originalText;
        downloadQrBtn.disabled = false;
      }
    };

    // Widget Modal Logic
    const widgetUrl = `${window.location.origin}/widget.html?id=${user.uid}`;
    const iframeCode = `<iframe src="${widgetUrl}" width="100%" height="400" frameborder="0" style="border-radius:16px; border:1px solid rgba(255,255,255,0.1); overflow:hidden;"></iframe>`;
    
    openWidgetModalBtn.onclick = () => {
      widgetCodeInput.value = iframeCode;
      widgetPreviewIframe.src = widgetUrl;
      widgetModal.style.display = 'flex';
    };

    closeWidgetModalBtn.onclick = () => {
      widgetModal.style.display = 'none';
      widgetPreviewIframe.src = '';
    };

    widgetModal.onclick = (e) => {
      if(e.target === widgetModal) {
        widgetModal.style.display = 'none';
        widgetPreviewIframe.src = '';
      }
    };

    copyWidgetCodeBtn.onclick = () => {
      navigator.clipboard.writeText(iframeCode);
      const originalText = copyWidgetCodeBtn.innerText;
      copyWidgetCodeBtn.innerText = "Skopiowano!";
      setTimeout(() => copyWidgetCodeBtn.innerText = originalText, 2000);
    };

    copyWidgetLinkBtn.onclick = () => {
      navigator.clipboard.writeText(widgetUrl);
      const originalText = copyWidgetLinkBtn.innerText;
      copyWidgetLinkBtn.innerText = "Skopiowano!";
      setTimeout(() => copyWidgetLinkBtn.innerText = originalText, 2000);
    };

    // Pobieranie Menu
    if(unsubscribeMenu) unsubscribeMenu();
    unsubscribeMenu = listenToMenu(user.uid, renderMenu);

    // Pobieranie Ustawień
    if(unsubscribeTheme) unsubscribeTheme();
    unsubscribeTheme = listenToTheme(user.uid, (theme) => {
      currentTheme = { ...currentTheme, ...theme };
      
      // Update Name
      restaurantNameInput.value = currentTheme.restaurantName || '';
      
      // Update Swatches UI
      bgSwatches.forEach(s => {
        if(s.dataset.color === currentTheme.bgColor) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
      fontSwatches.forEach(s => {
        if(s.dataset.font === currentTheme.fontFamily) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });

  } else {
    window.location.href = '/index.html';
  }
});

logoutBtn.addEventListener('click', async () => await logOut());

// Obsługa zapisu motywu (Debounce)
let themeTimeout;
function saveCurrentTheme() {
  clearTimeout(themeTimeout);
  themeTimeout = setTimeout(() => {
    if(currentUser) {
      saveTheme(currentUser.uid, currentTheme);
    }
  }, 500);
}

// Eventy dla nazwy restauracji
restaurantNameInput.addEventListener('input', (e) => {
  currentTheme.restaurantName = e.target.value;
  saveCurrentTheme();
});

// Eventy dla kafelków tła
bgSwatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color;
    // Wyciągnij kolor czcionki jeśli jest jawnie zdefiniowany (dla jasnych teł)
    const textColor = swatch.style.color ? (swatch.style.color === 'rgb(0, 0, 0)' ? '#000000' : swatch.style.color) : '#ffffff';
    
    currentTheme.bgColor = color;
    currentTheme.textColor = textColor;
    
    bgSwatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    
    saveCurrentTheme();
  });
});

// Eventy dla kafelków czcionek
fontSwatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    currentTheme.fontFamily = swatch.dataset.font;
    
    fontSwatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    
    saveCurrentTheme();
  });
});


addItemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!currentUser) return;
  
  addItemBtn.disabled = true;
  const item = {
    name: itemNameInput.value.trim(),
    desc: itemDescInput.value.trim(),
    price: parseFloat(itemPriceInput.value)
  };

  try {
    await addMenuItem(currentUser.uid, item, currentItemsCount);
    itemNameInput.value = '';
    itemDescInput.value = '';
    itemPriceInput.value = '';
  } catch (error) {
    alert("Wystąpił błąd przy dodawaniu dania.");
  } finally {
    addItemBtn.disabled = false;
  }
});

let sortableInstance = null;

function renderMenu(items) {
  currentItemsCount = items.length;
  menuList.innerHTML = '';
  
  if(items.length === 0) {
    menuList.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted);">Twoje menu jest puste. Dodaj pierwsze danie powyżej!</p>';
    if(sortableInstance) sortableInstance.destroy();
    return;
  }

  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'menu-item stagger-item';
    div.style.animationDelay = `${index * 0.05}s`;
    div.setAttribute('data-id', item.id);
    div.innerHTML = `
      <div class="drag-handle" title="Przeciągnij by zmienić kolejność">⋮⋮</div>
      <div class="item-info">
        <h3>${item.name}</h3>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">${item.desc || ''}</p>
      </div>
      <div style="display:flex; align-items:center; gap:15px;">
        <span class="item-price">${item.price.toFixed(2)} zł</span>
        <button class="delete-btn" data-id="${item.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          Usuń
        </button>
      </div>
    `;
    menuList.appendChild(div);
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      if(confirm('Na pewno usunąć?')) {
        await deleteMenuItem(currentUser.uid, id);
      }
    });
  });

  if(sortableInstance) sortableInstance.destroy();
  sortableInstance = new Sortable(menuList, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    onEnd: async () => {
      const newOrderIds = Array.from(menuList.children).map(child => child.getAttribute('data-id'));
      await updateMenuOrder(currentUser.uid, newOrderIds);
    }
  });
}

