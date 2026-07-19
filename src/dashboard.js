import { listenAuthState, logOut } from './auth';
import { addMenuItem, deleteMenuItem, listenToMenu, updateMenuOrder, saveTheme, listenToTheme } from './db';
import Sortable from 'sortablejs';
import QRCodeStyling from 'qr-code-styling';
import html2canvas from 'html2canvas';

const logoutBtn = document.getElementById('logoutBtn');
const dashboardContent = document.getElementById('dashboardContent');
const qrcodeContainer = document.getElementById('qrcode');
const publicLink = document.getElementById('publicLink');
const downloadQrBtn = document.getElementById('downloadQrBtn');

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
        const canvas = await html2canvas(qrcodeContainer, {
          backgroundColor: null,
          scale: 4, // High quality
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

