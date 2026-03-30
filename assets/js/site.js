
(function () {
  function parseBool(value) {
    return ["true", "1", "yes", "y"].includes(String(value || "").trim().toLowerCase());
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function formatCurrency(value) {
    const num = parseNumber(value);
    if (num === null) return value ? String(value) : "";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: (window.DEALS_SHEET_CONFIG && window.DEALS_SHEET_CONFIG.currency) || "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    } catch (e) {
      return "$" + num.toFixed(2);
    }
  }

  function computeSaveText(deal) {
    if (deal.save) return String(deal.save);
    const price = parseNumber(deal.price);
    const oldPrice = parseNumber(deal.old_price || deal.oldPrice);
    if (price === null || oldPrice === null || oldPrice <= 0 || price >= oldPrice) return "";
    return "Save " + Math.round(((oldPrice - price) / oldPrice) * 100) + "%";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeDeal(raw) {
  return {
    active: raw.active === undefined ? true : parseBool(raw.active),
    retailer: String(raw.retailer || "").trim(),
    homepage_feature: raw.homepage_feature === undefined ? false : parseBool(raw.homepage_feature),
    sort_order: parseNumber(raw.sort_order) ?? 9999,
    title: String(raw.title || "").trim(),
    price: raw.price,
    old_price: raw.old_price !== undefined ? raw.old_price : raw.oldPrice,
    save: raw.save || "",
    category: String(raw.category || "").trim(),
    badge: String(raw.badge || raw.category || "").trim(),
    code: String(raw.code || raw.coupon || raw.promo || raw.promo_code || "").trim(),
    status: String(raw.status || "").trim(),
    note: String(raw.note || "").trim(),
    link: String(raw.link || "#").trim() || "#",
    image: String(raw.image || "").trim()
  };
}

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(value);
        value = "";
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i++;
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else {
        value += char;
      }
    }
    if (value.length || row.length) {
      row.push(value);
      rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
    return rows.slice(1).filter(r => r.some(cell => String(cell || "").trim() !== "")).map(r => {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = r[idx] || "");
      return obj;
    });
  }

  function buildFromFallback() {
    const data = window.FALLBACK_DEALS_DATA || {};
    const amazon = Array.isArray(data.amazon) ? data.amazon.map(d => normalizeDeal({ ...d, active: true, retailer: "Amazon" })) : [];
    const walmart = Array.isArray(data.walmart) ? data.walmart.map(d => normalizeDeal({ ...d, active: true, retailer: "Walmart" })) : [];
    return {
      site: data.site || {},
      deals: amazon.concat(walmart)
    };
  }

  async function loadDeals() {
    const config = window.DEALS_SHEET_CONFIG || {};
    if (!config.csvUrl || config.csvUrl.indexOf("PASTE_GOOGLE_SHEETS_CSV_URL_HERE") !== -1) {
      return buildFromFallback();
    }
    try {
      const response = await fetch(config.csvUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not fetch CSV");
      const csvText = await response.text();
      const rows = parseCsv(csvText)
        .map(normalizeDeal)
        .filter(d => d.active && d.title && d.retailer)
        .sort((a, b) => (a.sort_order - b.sort_order) || a.title.localeCompare(b.title));
      return {
        site: {
          brandName: "DealsToEnvy",
          homepageTitle: "Daily Deals Worth Clicking",
          homepageSubtitle: "Your site is now driven by a Google Sheet, so daily deal posting is much easier.",
          featuredAmazonCount: Number(config.featuredAmazonCount || 3),
          featuredWalmartCount: Number(config.featuredWalmartCount || 2)
        },
        deals: rows
      };
    } catch (err) {
      console.warn("Falling back to sample deals because the sheet could not be loaded.", err);
      showFeedStatus("Could not load the Google Sheet feed yet, so the fallback sample deals are showing.");
      return buildFromFallback();
    }
  }

  function showFeedStatus(text, good) {
    const target = document.querySelector("[data-feed-status]");
    if (!target) return;
    target.textContent = text;
    target.classList.add("notice");
    if (good) target.classList.add("notice-good");
  }

  function dealCard(deal) {
    const searchable = `${deal.title} ${deal.category} ${deal.badge}`.toLowerCase();
    const price = formatCurrency(deal.price);
    const oldPrice = formatCurrency(deal.old_price);
    const save = computeSaveText(deal);
    return `
      <article class="card deal-card" data-title="${escapeHtml(searchable)}" data-category="${escapeHtml((deal.category || '').toLowerCase())}">
        <img class="card-media" src="${escapeHtml(deal.image || 'https://via.placeholder.com/800x600?text=Deal')}" alt="${escapeHtml(deal.title)}">
        <div class="card-body">
          <span class="badge">${escapeHtml(deal.badge || deal.category)}</span>
          <h3>${escapeHtml(deal.title)}</h3>
          <div class="price-row">
            <span class="price">${escapeHtml(price)}</span>
            ${oldPrice ? `<span class="old-price">${escapeHtml(oldPrice)}</span>` : ""}
            ${save ? `<span class="save">${escapeHtml(save)}</span>` : ""}
          </div>
          ${deal.category ? `<div class="meta"><strong>Category:</strong> ${escapeHtml(deal.category)}</div>` : ""}
          ${deal.code ? `<div class="meta"><strong>Promo:</strong> ${escapeHtml(deal.code)}</div>` : ""}
          ${deal.status ? `<div class="meta"><strong>Status:</strong> ${escapeHtml(deal.status)}</div>` : ""}
          ${deal.note ? `<p>${escapeHtml(deal.note)}</p>` : ""}
          <a class="btn btn-primary" href="${escapeHtml(deal.link)}" target="_blank" rel="nofollow sponsored noopener">View deal</a>
        </div>
      </article>
    `;
  }

  function miniCard(deal) {
  const price = formatCurrency(deal.price);
  const oldPrice = formatCurrency(deal.old_price);

  let couponHtml = "";

  if (deal.code) {
    const codeText = String(deal.code).trim().toUpperCase();

    if (codeText === "CLIP COUPON" || codeText === "AMAZON COUPON") {
      couponHtml = `<div class="coupon-pill">Clip coupon on Amazon</div>`;
    } else {
      couponHtml = `<div class="coupon-pill">Use Code: <strong>${escapeHtml(deal.code)}</strong></div>`;
    }
  }

  return `
    <article class="mini-card">
      <img class="card-media" src="${escapeHtml(deal.image || 'https://via.placeholder.com/800x600?text=Deal')}" alt="${escapeHtml(deal.title)}">
      <div class="card-body">
        <span class="badge">${escapeHtml(deal.badge || deal.category)}</span>
        <h3>${escapeHtml(deal.title)}</h3>
        <div class="price-row">
          <span class="price">${escapeHtml(price)}</span>
          ${oldPrice ? `<span class="old-price">${escapeHtml(oldPrice)}</span>` : ""}
        </div>
        ${couponHtml}
        <a class="btn btn-secondary" href="${escapeHtml(deal.link)}" target="_blank" rel="nofollow sponsored noopener">Open deal</a>
      </div>
    </article>
  `;
}

  function renderDeals(targetId, deals) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = deals.length ? deals.map(dealCard).join("") : `<div class="notice">No active deals found for this section yet.</div>`;
  }

  function renderMiniDeals(targetId, deals) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (!deals.length) {
    target.innerHTML = `<div class="notice">No featured deals marked yet.</div>`;
    return;
  }

  const sliderId = `${targetId}-slider`;
  const trackId = `${targetId}-track`;
  const prevId = `${targetId}-prev`;
  const nextId = `${targetId}-next`;

  target.innerHTML = `
    <div class="featured-slider" id="${sliderId}">
      <button class="featured-arrow featured-arrow-left" id="${prevId}" aria-label="Scroll left">&#10094;</button>

      <div class="featured-viewport">
        <div class="featured-track" id="${trackId}">
          ${deals.map(miniCard).join("")}
        </div>
      </div>

      <button class="featured-arrow featured-arrow-right" id="${nextId}" aria-label="Scroll right">&#10095;</button>
    </div>
  `;

  initFeaturedSlider(sliderId, trackId, prevId, nextId);
}
  function initFeaturedSlider(sliderId, trackId, prevId, nextId) {
  const slider = document.getElementById(sliderId);
  const track = document.getElementById(trackId);
  const prevBtn = document.getElementById(prevId);
  const nextBtn = document.getElementById(nextId);

  if (!slider || !track || !prevBtn || !nextBtn) return;

  const viewport = slider.querySelector(".featured-viewport");

  function getCardWidth() {
    const firstCard = track.querySelector(".mini-card");
    if (!firstCard) return 320;

    const cardStyles = window.getComputedStyle(firstCard);
    const cardWidth = firstCard.getBoundingClientRect().width;
    const marginRight = parseFloat(cardStyles.marginRight || "0");

    return cardWidth + marginRight + 20;
  }

  function updateButtons() {
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    prevBtn.disabled = viewport.scrollLeft <= 5;
    nextBtn.disabled = viewport.scrollLeft >= maxScroll - 5;
  }

  prevBtn.addEventListener("click", () => {
    viewport.scrollBy({ left: -getCardWidth(), behavior: "smooth" });
  });

  nextBtn.addEventListener("click", () => {
    viewport.scrollBy({ left: getCardWidth(), behavior: "smooth" });
  });

  viewport.addEventListener("scroll", updateButtons);
  window.addEventListener("resize", updateButtons);

  updateButtons();
}

  function enableSearch(inputId, containerId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    if (!input || !container) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      container.querySelectorAll(".deal-card").forEach(card => {
        card.style.display = card.dataset.title.includes(q) ? "" : "none";
      });
    });
  }

  function setLastUpdated() {
    const targets = document.querySelectorAll("[data-last-updated]");
    if (!targets.length) return;
    const formatted = new Date().toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric"
    });
    targets.forEach(el => { el.textContent = formatted; });
  }

  function setHeroCopy(site) {
    const t = document.querySelector("[data-site-title]");
    const s = document.querySelector("[data-site-subtitle]");
    if (t && site.homepageTitle) t.textContent = site.homepageTitle;
    if (s && site.homepageSubtitle) s.textContent = site.homepageSubtitle;
  }

  function byRetailer(deals, retailer) {
    return deals.filter(d => d.retailer.toLowerCase() === retailer.toLowerCase());
  }

  function featuredDeals(deals, retailer) {
    const matching = byRetailer(deals, retailer);
    const featured = matching.filter(d => d.homepage_feature);
    return featured.length ? featured : matching;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const payload = await loadDeals();
    const site = payload.site || {};
    const deals = Array.isArray(payload.deals) ? payload.deals : [];
    const amazon = byRetailer(deals, "Amazon");
    const walmart = byRetailer(deals, "Walmart");

    setHeroCopy(site);
    renderDeals("amazon-deals-grid", amazon);
    renderDeals("walmart-deals-grid", walmart);
    renderMiniDeals("featured-amazon-grid", featuredDeals(deals, "Amazon"));
    renderMiniDeals("featured-walmart-grid", featuredDeals(deals, "Walmart"));
    enableSearch("amazon-search", "amazon-deals-grid");
    enableSearch("walmart-search", "walmart-deals-grid");
    setLastUpdated();

    const config = window.DEALS_SHEET_CONFIG || {};
  });
})();
