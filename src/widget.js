import { listenToMenu, listenToTheme } from './db';

const widgetContainer = document.getElementById('widgetContainer');
const widgetList = document.getElementById('widgetList');
const widgetLoading = document.getElementById('widgetLoading');
const widgetTitle = document.getElementById('widgetTitle');
const fullMenuLink = document.getElementById('fullMenuLink');

const urlParams = new URLSearchParams(window.location.search);
const restaurantId = urlParams.get('id');

if (!restaurantId) {
  widgetLoading.innerText = "Błąd: Brak ID restauracji.";
} else {
  // Config link
  const menuUrl = `${window.location.origin}/menu.html?id=${restaurantId}`;
  fullMenuLink.href = menuUrl;
  
  // Theme
  listenToTheme(restaurantId, (theme) => {
    widgetContainer.style.backgroundColor = theme.bgColor || '#1c1c1e';
    widgetContainer.style.color = theme.textColor || '#ffffff';
    widgetContainer.style.fontFamily = theme.fontFamily || "'Inter', sans-serif";
    widgetTitle.innerText = theme.restaurantName || "Nasze Menu";
  });

  // Menu items (Top 3)
  listenToMenu(restaurantId, (items) => {
    widgetLoading.style.display = 'none';
    renderWidgetMenu(items.slice(0, 3));
    if (items.length > 0) {
      fullMenuLink.style.display = 'block';
    }
  });
}

function renderWidgetMenu(items) {
  widgetList.innerHTML = '';
  
  if(items.length === 0) {
    widgetList.innerHTML = '<p style="text-align:center; opacity:0.5; padding: 1rem 0; font-size: 0.9rem;">Menu wkrótce...</p>';
    return;
  }

  items.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'widget-item';
    
    div.innerHTML = `
      <div style="flex: 1; padding-right: 12px;">
        <div class="widget-item-name">${item.name}</div>
        ${item.desc ? `<div class="widget-item-desc">${item.desc}</div>` : ''}
      </div>
      <div class="widget-item-price">
        ${item.price.toFixed(2)} zł
      </div>
    `;
    widgetList.appendChild(div);
  });
}
