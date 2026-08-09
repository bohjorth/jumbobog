const TOTAL = 600;
const grid = document.getElementById("grid");
const search = document.getElementById("search");

let data = JSON.parse(localStorage.getItem("jumbo")) || {};

function save() {
  localStorage.setItem("jumbo", JSON.stringify(data));
}

function render(filter="") {
  grid.innerHTML = "";
  for (let i=1;i<=TOTAL;i++) {
    if (filter && !i.toString().includes(filter)) continue;

    const card = document.createElement("div");
    card.className = "card";
    if (data[i]?.owned) card.classList.add("owned");

    card.innerHTML = `
      <div>${i}</div>
      <small>${data[i]?.condition || ""}</small>
    `;

    card.onclick = () => openDetail(i);
    grid.appendChild(card);
  }
}

function openDetail(id) {
  const condition = prompt(
    "Stand:\nMint / Meget fin / Fin / Slidt / Meget slidt",
    data[id]?.condition || ""
  );

  if (condition !== null) {
    data[id] = {
      owned: true,
      condition: condition
    };
    save();
    render(search.value);
  }
}

search.oninput = () => render(search.value);

render();
