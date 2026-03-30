function getQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q")?.toLowerCase() || "";
}

async function loadSearchResults() {

  const keyword = getQuery();

  const label = document.getElementById("search-label");
  const resultsContainer = document.getElementById("search-results");

  if (!keyword) {
    label.textContent = "No keyword entered.";
    return;
  }

  label.textContent = 'Showing results for "' + keyword + '"';

  const deals = await loadDeals();   // comes from deals.js

  const results = deals.filter(deal => {
    const text = (
      deal.title +
      " " +
      (deal.note || "") +
      " " +
      (deal.category || "")
    ).toLowerCase();

    return text.includes(keyword);
  });

  if (results.length === 0) {
    resultsContainer.innerHTML =
      "<p>No deals found.</p>";
    return;
  }

  results.forEach(deal => {
    const card = createDealCard(deal);
    resultsContainer.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", loadSearchResults);