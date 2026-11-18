// En enkel vätska på ett rutnät (Jos Stams "Stable Fluids").
// Hastigheten flyttas med sig själv bakåt i tiden (semi-lagrangesk advektion),
// och sedan görs fältet virvelfritt i sammanpressning (tryckprojektion), så att
// vatten som inte får plats tar vägen runt hinder. Rutnätets y går nedåt.

// stangd: alla väggar stängda, som ett glas. Annars är botten öppen (utflöde).
export function skapaVatska(W, H, { iterationer = 20, stangd = false } = {}) {
  const n = W * H;
  const u = new Float32Array(n), v = new Float32Array(n);
  const u2 = new Float32Array(n), v2 = new Float32Array(n);
  const tryck = new Float32Array(n), div = new Float32Array(n);
  const fast = new Uint8Array(n);
  const virvel = new Float32Array(n);

  const I = (x, y) => y * W + x;

  // Bilinjär avläsning med kanterna fastklämda
  function las(f, x, y) {
    x = Math.max(0, Math.min(W - 1.001, x));
    y = Math.max(0, Math.min(H - 1.001, y));
    const x0 = x | 0, y0 = y | 0;
    const fx = x - x0, fy = y - y0;
    const i = y0 * W + x0;
    return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fy) + (f[i + W] * (1 - fx) + f[i + W + 1] * fx) * fy;
  }

  // Flytta ett fält med strömmen
  function advektera(ut, inn, dt) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (fast[i]) { ut[i] = 0; continue; }
        ut[i] = las(inn, x - u[i] * dt, y - v[i] * dt);
      }
    }
  }

  function projicera() {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        div[i] = fast[i] ? 0 : -0.5 * (u[i + 1] - u[i - 1] + v[i + W] - v[i - W]);
        tryck[i] = 0;
      }
    }
    for (let k = 0; k < iterationer; k++) {
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          if (fast[i]) continue;
          const p0 = tryck[i];
          const pl = fast[i - 1] ? p0 : tryck[i - 1];
          const pr = fast[i + 1] ? p0 : tryck[i + 1];
          const pu = fast[i - W] ? p0 : tryck[i - W];
          const pd = fast[i + W] ? p0 : tryck[i + W];
          tryck[i] = (div[i] + pl + pr + pu + pd) * 0.25;
        }
      }
      // Botten är öppen (utflöde) om inte glaset är stängt, sidorna är alltid stängda
      for (let x = 0; x < W; x++) {
        tryck[I(x, H - 1)] = stangd ? tryck[I(x, H - 2)] : 0;
        tryck[I(x, 0)] = tryck[I(x, 1)];
      }
      for (let y = 0; y < H; y++) { tryck[I(0, y)] = tryck[I(1, y)]; tryck[I(W - 1, y)] = tryck[I(W - 2, y)]; }
    }
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (fast[i]) { u[i] = 0; v[i] = 0; continue; }
        u[i] -= 0.5 * (tryck[i + 1] - tryck[i - 1]);
        v[i] -= 0.5 * (tryck[i + W] - tryck[i - W]);
      }
    }
    if (stangd) {
      for (let x = 0; x < W; x++) { v[I(x, 0)] = 0; v[I(x, H - 1)] = 0; u[I(x, 0)] = u[I(x, 1)]; u[I(x, H - 1)] = u[I(x, H - 2)]; }
      for (let y = 0; y < H; y++) { u[I(0, y)] = 0; u[I(W - 1, y)] = 0; v[I(0, y)] = v[I(1, y)]; v[I(W - 1, y)] = v[I(W - 2, y)]; }
    }
  }

  // Förstärker små virvlar som annars suddas ut av rutnätet
  function virvelForstarkning(styrka, dt) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        virvel[i] = 0.5 * ((v[i + 1] - v[i - 1]) - (u[i + W] - u[i - W]));
      }
    }
    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const i = y * W + x;
        if (fast[i]) continue;
        let gx = 0.5 * (Math.abs(virvel[i + 1]) - Math.abs(virvel[i - 1]));
        let gy = 0.5 * (Math.abs(virvel[i + W]) - Math.abs(virvel[i - W]));
        const l = Math.hypot(gx, gy) + 1e-5;
        gx /= l; gy /= l;
        const w = virvel[i];
        u[i] += gy * w * styrka * dt;
        v[i] -= gx * w * styrka * dt;
      }
    }
  }

  function steg(dt, { virvlar = 0 } = {}) {
    advektera(u2, u, dt);
    advektera(v2, v, dt);
    u.set(u2);
    v.set(v2);
    if (virvlar > 0) virvelForstarkning(virvlar, dt);
    projicera();
  }

  return { W, H, u, v, fast, virvel, las, advektera, steg, I };
}
