(function () {
  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function parseBool(value) {
    return ["true", "1", "yes", "y"].includes(String(value || "").trim().toLowerCase());
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

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
      } else if (char === "," && !inQuotes) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i++;
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

    return rows
      .slice(1)
      .filter(r => r.some(cell => String(cell || "").trim() !== ""))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = r[idx] || "";
        });
        return obj;
      });
  }

  function normalizeDeal(raw) {
    return {
      active: raw.active === undefined ? true : parseBool(raw.active),
      retailer: String(raw.retailer || "").trim(),
      sort_order: parseNumber(raw.sort_order) ?? 9999,
      title: String(raw.title || "").trim(),
      price: raw.price,
      old_price: raw.old_price !== undefined ? raw.old_price : raw.oldPrice,
      category: String(raw.category || "").trim(),
      badge: String(raw.badge || raw.category || "").trim(),
      code: String(raw.code || raw.coupon || raw.promo || raw.promo_code || "").trim(),
      note: String(raw.note || "").trim(),
      link: String(raw.link || "#").trim() || "#",
      image: String(raw.image || "").trim(),
      featured_in_article:
        raw.featuredinarticle === undefined
          ? false
          : parseBool(raw.featuredinarticle)
    };
  }

  async function loadDeals() {
    const config = window.DEALS_SHEET_CONFIG || {};
    if (!config.csvUrl || config.csvUrl.indexOf("PASTE_GOOGLE_SHEETS_CSV_URL_HERE") !== -1) {
      return [];
    }

    const response = await fetch(config.csvUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not fetch CSV");

    const csvText = await response.text();

    return parseCsv(csvText)
      .map(normalizeDeal)
      .filter(d => d.active && d.title && d.retailer);
  }

  function promoMarkup(deal) {
    if (!deal.code) return "";

    const codeText = String(deal.code).trim().toUpperCase();

    if (codeText === "CLIP COUPON" || codeText === "AMAZON COUPON") {
      return `<div class="promo-code">Clip coupon on Amazon</div>`;
    }

    return `<div class="promo-code">Use Code: <strong>${escapeHtml(deal.code)}</strong></div>`;
  }

  function renderDealCard(deal) {
    const price = formatCurrency(deal.price);
    const oldPrice = formatCurrency(deal.old_price);

    return `
      <article class="card deal-card deal-card-horizontal">
        <div class="deal-card-image-wrap">
          <img class="card-media deal-card-image" src="${escapeHtml(deal.image || "https://via.placeholder.com/800x600?text=Deal")}" alt="${escapeHtml(deal.title)}">
        </div>

        <div class="card-body deal-card-body-horizontal">
          <div class="deal-card-top">
            <span class="badge">${escapeHtml(deal.retailer || deal.badge || deal.category)}</span>
            <h3>${escapeHtml(deal.title)}</h3>
          </div>

          <div class="price-row">
            <span class="price">${price}</span>
            ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ""}
          </div>

          ${promoMarkup(deal)}
          ${deal.note ? `<p class="deal-note">${escapeHtml(deal.note)}</p>` : ""}

          <div class="deal-card-actions">
            <a class="btn btn-primary" href="${escapeHtml(deal.link)}" target="_blank" rel="nofollow sponsored noopener">
              View deal
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function matchesCategory(deal, category) {
    const dealCategory = String(deal.category || "").trim().toLowerCase();
    return dealCategory.includes(category.toLowerCase());
  }

  async function runArticlePage() {
    const config = window.DEALS_ARTICLE_CONFIG || {};
    const category = config.category || "";
    const grid = document.getElementById("article-deals-grid");

    if (!grid || !category) return;

    try {
      const deals = await loadDeals();

      const matches = deals
        .filter(deal => deal.featured_in_article)
        .filter(deal => matchesCategory(deal, category))
        .sort((a, b) => (a.sort_order - b.sort_order) || a.title.localeCompare(b.title));

      if (!matches.length) {
        grid.innerHTML = `<div class="notice">No active deals found for this category yet.</div>`;
        return;
      }

      grid.innerHTML = matches.map(renderDealCard).join("");
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<div class="notice">Could not load deals right now.</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", runArticlePage);
})();
