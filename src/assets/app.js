/* Shared interactions: custom cursor, sticky header, posts filter */
(function () {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setupCursor() {
    const cur = document.getElementById("cur");
    if (!cur) return;
    if (!finePointer.matches) {
      cur.classList.remove("is-on");
      return;
    }
    cur.classList.add("is-on");
    const growSel = "a,button,input,textarea,.card,.item,.chip,.tag,.toggle button,.search";
    const move = (e) => {
      cur.style.left = e.clientX + "px";
      cur.style.top = e.clientY + "px";
      cur.classList.toggle("big", !!e.target.closest(growSel));
    };
    window.addEventListener("mousemove", move);
  }

  function setupHeader() {
    const hdr = document.getElementById("hdr");
    if (!hdr || hdr.classList.contains("always")) return;
    const update = () => {
      const threshold = Math.max(window.innerHeight * 0.55, 240);
      hdr.classList.toggle("show", window.scrollY > threshold);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  function setupFilter() {
    const root = document.getElementById("posts-app");
    if (!root) return;
    const dataEl = document.getElementById("posts-data");
    if (!dataEl) return;
    let posts = [];
    try {
      posts = JSON.parse(dataEl.textContent);
    } catch (err) {
      return;
    }

    const q = document.getElementById("q");
    const info = document.getElementById("info");
    const grid = document.getElementById("g");
    const empty = document.getElementById("empty");
    let sort = "new";
    let tag = root.dataset.activeTag || "";

    function matches(p, key) {
      if (!key) return true;
      const blob = (p.title + " " + (p.excerpt || "") + " " + (p.tags || []).join(" ")).toLowerCase();
      return blob.includes(key);
    }

    function render() {
      const key = (q && q.value ? q.value : "").trim().toLowerCase();
      let list = posts.filter((p) => matches(p, key) && (!tag || (p.tags || []).includes(tag)));
      list.sort((a, b) => (sort === "new" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));

      const bits = [];
      if (key) bits.push('"' + key + '"');
      if (tag) bits.push("#" + tag);
      if (info) {
        info.textContent = bits.length
          ? "Showing " + list.length + " of " + posts.length + " matching " + bits.join(" ")
          : "";
      }

      if (grid) {
        grid.innerHTML = list
          .map((p) => {
            const tags = (p.tags || [])
              .map((t) => '<span class="tag">' + escapeHtml(t) + "</span>")
              .join("");
            return (
              '<a class="item" href="' +
              escapeAttr(p.url) +
              '"><div class="th"><div style="background:' +
              escapeAttr(p.cover) +
              '"></div></div><p class="title">' +
              escapeHtml(p.title) +
              "</p><small>" +
              escapeHtml(p.dateLabel) +
              "</small><div class='tags'>" +
              tags +
              "</div></a>"
            );
          })
          .join("");
      }
      if (empty) empty.hidden = list.length > 0;
    }

    if (q) q.addEventListener("input", render);
    document.querySelectorAll(".toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".toggle button").forEach((b) => {
          b.classList.remove("on");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("on");
        btn.setAttribute("aria-pressed", "true");
        sort = btn.getAttribute("data-s") || "new";
        render();
      });
    });
    document.querySelectorAll(".chip-row .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const value = chip.getAttribute("data-tag") || "";
        const next = tag === value ? "" : value;
        tag = next;
        document.querySelectorAll(".chip-row .chip").forEach((c) => {
          const on = (c.getAttribute("data-tag") || "") === tag && tag !== "";
          c.classList.toggle("on", on);
          c.setAttribute("aria-pressed", on ? "true" : "false");
        });
        render();
      });
    });
    render();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  setupCursor();
  setupHeader();
  setupFilter();
  if (typeof reduceMotion.matches === "boolean" && reduceMotion.matches) {
    document.documentElement.classList.add("reduce-motion");
  }
})();
