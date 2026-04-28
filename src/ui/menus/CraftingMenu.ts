import type { Inventory } from "../../game/systems/Inventory";
import type { CraftingContext, RecipeAvailability } from "../../game/systems/Crafting";
import { craft, evaluateRecipes } from "../../game/systems/Crafting";
import { ITEMS } from "../../game/data/items";
import { Station } from "../../game/data/recipes";

const STATION_LABEL: Record<string, string> = {
  hand: "Hand",
  workbench: "Workbench",
  forge: "Forge",
  alien_bench: "Alien Tech",
};

/**
 * Crafting menu — HTML overlay. Open with C, close with C / Esc.
 * Renders a list of recipes grouped by station; click a craftable row to
 * synchronously craft (we ship without the time delay for v1).
 */
export class CraftingMenu {
  private readonly root: HTMLElement;
  private readonly inv: Inventory;
  private readonly getCtx: () => CraftingContext;
  open = false;

  constructor(inv: Inventory, getCtx: () => CraftingContext) {
    this.inv = inv;
    this.getCtx = getCtx;
    this.root = document.createElement("div");
    this.root.id = "crafting-menu";
    this.root.hidden = true;
    document.body.appendChild(this.root);
    this.root.addEventListener("click", this.onClick);
  }

  toggle(force?: boolean) {
    this.open = force ?? !this.open;
    this.root.hidden = !this.open;
    if (this.open) {
      this.render();
    } else {
      // Restore canvas focus so the next keystroke reaches Babylon's
      // keyboard observable.
      (document.getElementById("renderCanvas") as HTMLElement | null)?.focus();
    }
  }

  refresh() {
    if (this.open) this.render();
  }

  private render() {
    const ctx = this.getCtx();
    const groups = groupByStation(evaluateRecipes(this.inv, ctx));
    const invHtml = this.inv
      .entries()
      .map(([id, q]) => `<li><span>${escapeHtml(ITEMS[id]?.name ?? id)}</span><b>${q}</b></li>`)
      .join("");

    const groupsHtml = Object.entries(groups)
      .map(
        ([station, list]) => `
        <section class="cm-group">
          <h3>${escapeHtml(STATION_LABEL[station] ?? station)}${
            station !== Station.Hand && !ctx.nearbyStations.includes(station as never)
              ? ' <em>(no station nearby)</em>'
              : ""
          }</h3>
          <ul>
            ${list.map((r) => recipeRow(r)).join("")}
          </ul>
        </section>`,
      )
      .join("");

    this.root.innerHTML = `
      <div class="cm-panel">
        <header>
          <h2>Crafting</h2>
          <button data-act="close" aria-label="Close">×</button>
        </header>
        <div class="cm-body">
          <div class="cm-recipes">${groupsHtml}</div>
          <aside class="cm-inv">
            <h3>Inventory</h3>
            <ul>${invHtml || '<li class="cm-empty">empty</li>'}</ul>
          </aside>
        </div>
        <footer><kbd>C</kbd> close</footer>
      </div>
    `;
  }

  private onClick = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    const close = target.closest('[data-act="close"]');
    if (close) {
      this.toggle(false);
      return;
    }
    const row = target.closest<HTMLElement>("[data-recipe]");
    if (row && row.dataset.craftable === "true") {
      const id = row.dataset.recipe!;
      const result = craft(id, this.inv, this.getCtx());
      if (result.ok) this.render();
    }
  };
}

function recipeRow(r: RecipeAvailability): string {
  const out = ITEMS[r.recipe.output.itemId];
  const name = out?.name ?? r.recipe.output.itemId;
  const cost = r.recipe.inputs
    .map((i) => `${i.qty}× ${ITEMS[i.itemId]?.name ?? i.itemId}`)
    .join(", ");
  const cls = [
    "cm-recipe",
    r.craftable ? "ok" : "",
    !r.hasInputs ? "no-inputs" : "",
    !r.hasStation ? "no-station" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <li class="${cls}" data-recipe="${escapeHtml(r.recipe.id)}" data-craftable="${r.craftable}">
      <div class="cm-recipe-main">
        <span class="cm-recipe-name">${escapeHtml(name)}${r.recipe.output.qty > 1 ? ` ×${r.recipe.output.qty}` : ""}</span>
        <span class="cm-recipe-cost">${escapeHtml(cost)}</span>
      </div>
      <button class="cm-craft-btn" type="button" ${r.craftable ? "" : "disabled"}>Craft</button>
    </li>`;
}

function groupByStation(rs: RecipeAvailability[]): Record<string, RecipeAvailability[]> {
  const out: Record<string, RecipeAvailability[]> = {};
  for (const r of rs) {
    (out[r.recipe.station] ??= []).push(r);
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
