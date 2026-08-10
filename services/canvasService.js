const { createCanvas, loadImage } = require('canvas');

// Función auxiliar para dibujar rectángulos con bordes redondeados
function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

async function generarCollagePokemon(listaPokemonData) {
  const colCount = 2;
  const rowCount = 5; // <--- CAMBIADO A 5 FILAS (2x5 = 10 Pokémon por foto)
  const cardWidth = 460; 
  const cardHeight = 260; 
  const margin = 25;

  const canvasWidth = (colCount * cardWidth) + ((colCount + 1) * margin);
  const canvasHeight = (rowCount * cardHeight) + ((rowCount + 1) * margin);

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Fondo principal
  ctx.fillStyle = '#0f172a'; 
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const statColors = {
    hp: '#22c55e',    
    atk: '#ef4444',   
    def: '#3b82f6',   
    spAtk: '#a855f7', 
    spDef: '#06b6d4', 
    vel: '#ec4899'    
  };

  for (let i = 0; i < listaPokemonData.length; i++) {
    const p = listaPokemonData[i];
    const col = i % colCount;
    const row = Math.floor(i / colCount);

    const x = margin + (col * (cardWidth + margin));
    const y = margin + (row * (cardHeight + margin));

    // Fondo de la tarjeta
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8'; 
    ctx.lineWidth = 2;
    drawRoundRect(ctx, x, y, cardWidth, cardHeight, 15, true, true);

    // Cabecera
    ctx.fillStyle = '#f8fafc'; 
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.nombre.toUpperCase(), x + 20, y + 40);

    ctx.fillStyle = '#38bdf8'; 
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText(`[ ${p.tipos} ]`, x + 20, y + 65);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Nv. ${p.nivel || 1} | ${p.experiencia || 0} XP`, x + cardWidth - 20, y + 40);
    ctx.textAlign = 'left';

    // Línea separadora
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 75); 
    ctx.lineTo(x + cardWidth - 20, y + 75); 
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    // Renderizado de Estadísticas
    const statsInfo = [
      { label: 'HP', value: p.hp, color: statColors.hp },
      { label: 'ATK', value: p.atk, color: statColors.atk },
      { label: 'DEF', value: p.def, color: statColors.def },
      { label: 'SP.ATK', value: p.spAtk, color: statColors.spAtk },
      { label: 'SP.DEF', value: p.spDef, color: statColors.spDef },
      { label: 'VEL', value: p.vel, color: statColors.vel }
    ];

    const statsX = x + 180; 
    const startY = y + 80;
    const barWidth = 200; 
    const barHeight = 16; 
    const maxStat = 500; 

    statsInfo.forEach((stat, index) => {
      const currentY = startY + (index * 28);
      
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(stat.label, statsX, currentY + 13);
      
      ctx.fillStyle = '#0f172a';
      drawRoundRect(ctx, statsX + 65, currentY, barWidth, barHeight, 8, true, false);

      const fillWidth = Math.min((stat.value / maxStat) * barWidth, barWidth);
      ctx.fillStyle = stat.color;
      drawRoundRect(ctx, statsX + 65, currentY, Math.max(fillWidth, 10), barHeight, 8, true, false);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(stat.value, statsX + 65 + (barWidth / 2), currentY + 12);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });

    // Renderizado del Sprite
    ctx.beginPath();
    ctx.arc(x + 100, y + 150, 70, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    if (p.spriteUrl) {
      try {
        const sprite = await loadImage(p.spriteUrl);
        ctx.drawImage(sprite, x + 30, y + 80, 140, 140);
      } catch (e) { 
        console.error(`Error cargando sprite de ${p.nombre}:`, e); 
      }
    }
  }

  return canvas.toBuffer('image/png');
}

async function generarImagenVersus(poke1, poke2) {
  const canvasWidth = 600;
  const canvasHeight = 320;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  try {
    if (poke1.url) {
      const img1 = await loadImage(poke1.url);
      ctx.drawImage(img1, 40, 40, 200, 200);
    }
    if (poke2.url) {
      const img2 = await loadImage(poke2.url);
      ctx.drawImage(img2, 360, 40, 200, 200);
    }
  } catch (error) {
    console.error('Error cargando sprites para el VS:', error);
  }

  ctx.fillStyle = '#ef4444'; 
  ctx.font = 'bold 70px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;
  ctx.fillText('VS', canvasWidth / 2, canvasHeight / 2 - 20);
  ctx.shadowBlur = 0; 

  ctx.fillStyle = '#f8fafc'; 
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(poke1.nombre.toUpperCase(), 140, 280);
  ctx.fillText(poke2.nombre.toUpperCase(), 460, 280);

  return canvas.toBuffer('image/png');
}

async function generarSilueta(urlImagen) {
  try {
    const img = await loadImage(urlImagen);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);

    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#000000'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error al generar silueta:', error);
    return null;
  }
}

async function generarImagenIncubadora(huevosEnEspera) {
  const canvasWidth = 900;
  const canvasHeight = 450;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // 1. Fondo de Laboratorio (Degradado oscuro de arriba a abajo)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGrad.addColorStop(0, '#020617'); // Negro azulado muy oscuro
  bgGrad.addColorStop(1, '#0f172a'); // Pizarra oscuro
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Rejilla técnica de fondo (Sutil)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvasWidth; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvasHeight); ctx.stroke();
  }
  for (let i = 0; i < canvasHeight; i += 40) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvasWidth, i); ctx.stroke();
  }

  // 2. Título de Alta Tecnología
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#cffafe';
  ctx.font = 'bold 36px "Courier New", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🧬 CÁMARAS DE INCUBACIÓN 🧬', canvasWidth / 2, 55);
  ctx.shadowBlur = 0; // Resetear sombra

  ctx.fillStyle = '#64748b';
  ctx.font = '16px sans-serif';
  ctx.fillText('NÚCLEO DE DESARROLLO GENÉTICO Y CRIANZA', canvasWidth / 2, 85);

  // Configuración de los Tubos
  const maxHuevos = 3;
  const tubeWidth = 240;
  const tubeHeight = 310;
  const margin = (canvasWidth - (maxHuevos * tubeWidth)) / (maxHuevos + 1);
  const y = 110;

  for (let i = 0; i < maxHuevos; i++) {
    const x = margin + (i * (tubeWidth + margin));
    const cx = x + tubeWidth / 2;
    const huevo = huevosEnEspera[i];

    // --- A. TAPAS METÁLICAS DEL TUBO ---
    const metalGrad = ctx.createLinearGradient(x, 0, x + tubeWidth, 0);
    metalGrad.addColorStop(0, '#334155');
    metalGrad.addColorStop(0.2, '#94a3b8');
    metalGrad.addColorStop(0.5, '#475569');
    metalGrad.addColorStop(0.8, '#94a3b8');
    metalGrad.addColorStop(1, '#1e293b');

    // Tapa Superior
    ctx.fillStyle = metalGrad;
    drawRoundRect(ctx, x - 10, y - 15, tubeWidth + 20, 20, 6, true, false);
    // Tapa Inferior
    drawRoundRect(ctx, x - 10, y + tubeHeight - 5, tubeWidth + 20, 25, 6, true, false);

    // --- B. INTERIOR DEL TUBO ---
    const liquidGrad = ctx.createLinearGradient(x, y, x, y + tubeHeight);
    if (huevo) {
      // Tubo Activo (Líquido brillante)
      liquidGrad.addColorStop(0, 'rgba(6, 182, 212, 0.15)'); // Cian claro
      liquidGrad.addColorStop(1, 'rgba(59, 130, 246, 0.5)'); // Azul profundo
    } else {
      // Tubo Inactivo (Oscuro)
      liquidGrad.addColorStop(0, 'rgba(15, 23, 42, 0.4)');
      liquidGrad.addColorStop(1, 'rgba(30, 41, 59, 0.6)');
    }
    
    ctx.fillStyle = liquidGrad;
    drawRoundRect(ctx, x, y, tubeWidth, tubeHeight, 10, true, false);

    if (huevo) {
      // --- C. ESTADO ACTIVO (HUEVO) ---
      
      // Burbujas de incubación flotando
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for(let b = 0; b < 25; b++) {
          ctx.beginPath();
          ctx.arc(x + 15 + Math.random() * (tubeWidth - 30), y + 20 + Math.random() * (tubeHeight - 60), Math.random() * 4 + 1, 0, Math.PI * 2);
          ctx.fill();
      }

      // Sombra del huevo flotando
      const cy = y + tubeHeight / 2 - 25;
      ctx.shadowColor = '#0ea5e9';
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 90, 50, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Volumen 3D del Huevo (Degradado radial)
      const eggGrad = ctx.createRadialGradient(cx - 20, cy - 25, 10, cx, cy, 80);
      eggGrad.addColorStop(0, '#ffffff'); // Luz focal
      eggGrad.addColorStop(0.6, '#f8fafc'); // Color base
      eggGrad.addColorStop(1, '#94a3b8'); // Sombra en los bordes

      ctx.beginPath();
      ctx.ellipse(cx, cy, 65, 85, 0, 0, Math.PI * 2);
      ctx.fillStyle = eggGrad;
      ctx.fill();

      // Manchas del huevo (Recortadas perfectamente al borde usando clip)
      ctx.save(); // Guardar contexto
      ctx.beginPath();
      ctx.ellipse(cx, cy, 65, 85, 0, 0, Math.PI * 2);
      ctx.clip(); // Aplicar máscara de recorte

      ctx.fillStyle = '#4ade80'; // Verde brillante
      ctx.beginPath(); ctx.ellipse(cx - 30, cy + 25, 20, 30, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 35, cy - 15, 15, 22, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy - 50, 25, 15, 0, 0, Math.PI * 2); ctx.fill();
      
      ctx.restore(); // Restaurar contexto y quitar el clip

      // Panel LED de tiempo
      const panelY = y + tubeHeight - 60;
      ctx.fillStyle = '#020617'; // Fondo negro del LED
      drawRoundRect(ctx, x + 30, panelY, tubeWidth - 60, 40, 8, true, false);

      // Borde del panel
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      drawRoundRect(ctx, x + 30, panelY, tubeWidth - 60, 40, 8, false, true);

      // Texto LED Neón
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = 'center';
      
      // Formatear tiempo para que siempre tenga 2 dígitos (Ej: 05h 09m)
      const hh = String(huevo.horas).padStart(2, '0');
      const mm = String(huevo.minutos).padStart(2, '0');
      ctx.fillText(`${hh}H ${mm}M`, cx, panelY + 28);
      ctx.shadowBlur = 0;

    } else {
      // --- D. ESTADO INACTIVO (VACÍO) ---
      const cy = y + tubeHeight / 2 - 10;
      
      // Holograma fantasma de un huevo
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]); // Línea punteada
      ctx.beginPath();
      ctx.ellipse(cx, cy - 10, 55, 75, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // Quitar punteado

      // Texto de Inactivo
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('INACTIVO', cx, cy + 110);
    }

    // --- E. REFLEJO DEL CRISTAL (Glassmorphism overlay) ---
    // Se dibuja al final para que cubra el líquido y el huevo
    const reflectGrad = ctx.createLinearGradient(x, y, x + tubeWidth, y);
    reflectGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    reflectGrad.addColorStop(0.15, 'rgba(255, 255, 255, 0.25)'); // Brillo principal del cristal
    reflectGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
    reflectGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = reflectGrad;
    drawRoundRect(ctx, x, y, tubeWidth, tubeHeight, 10, true, false);

    // Contorno exterior del tubo
    ctx.strokeStyle = huevo ? '#06b6d4' : '#334155'; // Brilla si está encendido
    ctx.lineWidth = 2;
    drawRoundRect(ctx, x, y, tubeWidth, tubeHeight, 10, false, true);
  }

  return canvas.toBuffer('image/png');
}

async function generarImagenPoketeam(equipoArray) {
  const colCount = 2;
  const rowCount = 3;
  const cardWidth = 460; 
  const cardHeight = 260; 
  const margin = 25;

  const canvasWidth = (colCount * cardWidth) + ((colCount + 1) * margin);
  const canvasHeight = (rowCount * cardHeight) + ((rowCount + 1) * margin);

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f172a'; 
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const statColors = {
    hp: '#22c55e', atk: '#ef4444', def: '#3b82f6', 
    spAtk: '#a855f7', spDef: '#06b6d4', vel: '#ec4899'    
  };

  for (let i = 0; i < 6; i++) {
    const p = equipoArray[i]; 
    const col = i % colCount;
    const row = Math.floor(i / colCount);

    const x = margin + (col * (cardWidth + margin));
    const y = margin + (row * (cardHeight + margin));

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = p ? '#38bdf8' : '#334155';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, x, y, cardWidth, cardHeight, 15, true, true);

    if (p) {
      ctx.fillStyle = '#f8fafc'; 
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`[${i + 1}] ${p.nombre.toUpperCase()}`, x + 20, y + 40);

      ctx.fillStyle = '#38bdf8'; 
      ctx.font = 'italic 16px sans-serif';
      ctx.fillText(`[ ${p.tipos} ]`, x + 20, y + 65);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Nv. ${p.nivel || 1} | ${p.experiencia || 0} XP`, x + cardWidth - 20, y + 40);
      ctx.textAlign = 'left';

      ctx.beginPath();
      ctx.moveTo(x + 20, y + 75); 
      ctx.lineTo(x + cardWidth - 20, y + 75); 
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      const statsInfo = [
        { label: 'HP', value: p.hp, color: statColors.hp },
        { label: 'ATK', value: p.atk, color: statColors.atk },
        { label: 'DEF', value: p.def, color: statColors.def },
        { label: 'SP.ATK', value: p.spAtk, color: statColors.spAtk },
        { label: 'SP.DEF', value: p.spDef, color: statColors.spDef },
        { label: 'VEL', value: p.vel, color: statColors.vel }
      ];

      const statsX = x + 180; 
      const startY = y + 80;
      const barWidth = 200; 
      const barHeight = 16; 
      const maxStat = 500; 

      statsInfo.forEach((stat, index) => {
        const currentY = startY + (index * 28);
        
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(stat.label, statsX, currentY + 13);
        
        ctx.fillStyle = '#0f172a';
        drawRoundRect(ctx, statsX + 65, currentY, barWidth, barHeight, 8, true, false);

        const fillWidth = Math.min((stat.value / maxStat) * barWidth, barWidth);
        ctx.fillStyle = stat.color;
        drawRoundRect(ctx, statsX + 65, currentY, Math.max(fillWidth, 10), barHeight, 8, true, false);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(stat.value, statsX + 65 + (barWidth / 2), currentY + 12);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      });

      ctx.beginPath();
      ctx.arc(x + 100, y + 150, 70, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.stroke();

      if (p.spriteUrl) {
        try {
          const sprite = await loadImage(p.spriteUrl);
          ctx.drawImage(sprite, x + 30, y + 80, 140, 140);
        } catch (e) { 
          console.error(`Error cargando sprite de ${p.nombre}:`, e); 
        }
      }
    } else {
      ctx.fillStyle = '#475569'; 
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`POSICIÓN ${i + 1}`, x + (cardWidth / 2), y + 80);

      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(x + (cardWidth / 2), y + 160, 50, 0, Math.PI * 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]); 

      ctx.font = '16px sans-serif';
      ctx.fillText('VACÍO', x + (cardWidth / 2), y + 165);
    }
  }

  return canvas.toBuffer('image/png');
}

async function generarImagenInventario(inv, nombreEntrenador) {
  const colCount = 4; 
  const rowCount = 3;
  const cardWidth = 200; 
  const cardHeight = 180; 
  const margin = 20;

  const canvasWidth = (colCount * cardWidth) + ((colCount + 1) * margin);
  const canvasHeight = (rowCount * cardHeight) + ((rowCount + 1) * margin) + 100;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`🎒 INVENTARIO DE ${nombreEntrenador.toUpperCase()}`, canvasWidth / 2, 60);

  const items = [
    { label: 'MONEDAS', value: inv.monedas || 0, icon: '💰', color: '#fbbf24' },
    { label: 'POKÉBALLS', value: inv.pokeballs || 0, icon: '🔴', color: '#ef4444' },
    { label: 'POCIÓN XP', value: inv.pocion_xp_small || 0, icon: '🧪', color: '#38bdf8' },
    { label: 'ROCAS EVOL.', value: inv.rocas_evolutivas || 0, icon: '🪨', color: '#a855f7' },
    { label: 'PUNTA ADN', value: inv.punta_adn || 0, icon: '🧬', color: '#22c55e' },
    { label: 'HUEVOS', value: inv.egg || 0, icon: '🥚', color: '#fef3c7' },
    { label: 'MEGA ENERGÍA', value: inv.mega_energia || 0, icon: '🧿', color: '#f472b6' },
    { label: 'LLAVE MAZMORRA', value: inv.llave_mazmorra || 0, icon: '🗝️', color: '#94a3b8' },
    { label: 'SEMILLAS', value: inv.semilla || 0, icon: '🌰', color: '#bef264' },
    { label: 'CULTIVOS', value: inv.cultivos || 0, icon: '🌾', color: '#fcd34d' },
    { label: 'HERRAMIENTAS', value: inv.herramientas || 0, icon: '🛠️', color: '#cbd5e1' }
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const col = i % colCount;
    const row = Math.floor(i / colCount);

    const x = margin + (col * (cardWidth + margin));
    const y = 100 + margin + (row * (cardHeight + margin));

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = item.color; 
    ctx.lineWidth = 2;
    drawRoundRect(ctx, x, y, cardWidth, cardHeight, 15, true, true);

    ctx.fillStyle = '#ffffff'; 
    ctx.font = '60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.icon, x + (cardWidth / 2), y + 75);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(item.label, x + (cardWidth / 2), y + 120);

    ctx.fillStyle = item.color;
    ctx.font = 'bold 36px sans-serif';
    if (item.value === 0) ctx.fillStyle = '#475569'; 
    ctx.fillText(`x${item.value}`, x + (cardWidth / 2), y + 165);
  }

  return canvas.toBuffer('image/png');
}

async function generarImagenExpediciones(expediciones) {
  const canvasWidth = 900;
  const canvasHeight = 400;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#022c22'; 
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.3;
  for(let i=0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * canvasWidth, Math.random() * 150, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = '#fef08a'; 
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏕️ CAMPAMENTO DE EXPEDICIONES 🏕️', canvasWidth / 2, 50);

  const maxSlots = 3;
  const slotWidth = 260;
  const slotHeight = 280;
  const margin = (canvasWidth - (maxSlots * slotWidth)) / (maxSlots + 1);

  for (let i = 0; i < maxSlots; i++) {
    const exp = expediciones[i];
    const x = margin + (i * (slotWidth + margin));
    const y = 90; 

    ctx.fillStyle = '#064e3b'; 
    ctx.strokeStyle = exp ? (exp.completado ? '#fbbf24' : '#34d399') : '#166534';
    ctx.lineWidth = 3;
    drawRoundRect(ctx, x, y, slotWidth, slotHeight, 20, true, true);

    if (exp) {
      ctx.beginPath();
      ctx.arc(x + slotWidth / 2, y + 100, 65, 0, Math.PI * 2);
      ctx.fillStyle = '#022c22';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#10b981';
      ctx.stroke();

      if (exp.spriteUrl) {
        try {
          const sprite = await loadImage(exp.spriteUrl);
          ctx.drawImage(sprite, x + slotWidth / 2 - 60, y + 35, 120, 120);
        } catch (e) { 
          console.error('Error cargando sprite para expedición:', e); 
        }
      }

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(exp.nombre.toUpperCase(), x + slotWidth / 2, y + 200);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Nivel ${exp.nivel}`, x + slotWidth / 2, y + 225);

      const barWidth = 200;
      const barHeight = 14;
      const barX = x + 30;
      const barY = y + 240;

      ctx.fillStyle = '#022c22';
      drawRoundRect(ctx, barX, barY, barWidth, barHeight, 7, true, false);

      const porcentajeReal = Math.min(Math.max(exp.progreso, 0.05), 1);
      const fillWidth = porcentajeReal * barWidth;
      
      ctx.fillStyle = exp.completado ? '#fbbf24' : '#10b981';
      drawRoundRect(ctx, barX, barY, fillWidth, barHeight, 7, true, false);

      ctx.fillStyle = exp.completado ? '#fde047' : '#6ee7b7';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(exp.textoEstado, x + slotWidth / 2, y + 270);

    } else {
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(x + slotWidth / 2, y + 130, 50, 0, Math.PI * 2);
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]); 

      ctx.fillStyle = '#166534';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DISPONIBLE', x + slotWidth / 2, y + 220);
    }
  }

  return canvas.toBuffer('image/png');
}

// ==========================================
// NUEVO: GENERADOR DE IMAGEN PARA SACRIFICIO (VERSIÓN TENEBROSA Y MÁGICA)
// ==========================================
async function generarImagenSacrificio(pokemones) {
  const canvasWidth = 800;
  const canvasHeight = 800;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Centro exacto del ritual
  const cx = 400;
  const cy = 460;

  // 1. Fondo de Abismo (Degradado radial de púrpura profundo a negro)
  const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 600);
  bgGrad.addColorStop(0, '#150524'); // Púrpura oscuro en el centro
  bgGrad.addColorStop(0.6, '#05010a'); // Casi negro
  bgGrad.addColorStop(1, '#000000'); // Negro absoluto
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Partículas de Almas (Puntos brillantes flotando)
  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#ef4444' : '#c084fc'; // Rojo o Púrpura
    ctx.globalAlpha = Math.random() * 0.6 + 0.1;
    ctx.beginPath();
    ctx.arc(Math.random() * canvasWidth, Math.random() * canvasHeight, Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // 3. Círculos Rúnicos Mágicos
  ctx.shadowColor = '#9333ea';
  ctx.shadowBlur = 25;
  ctx.strokeStyle = '#c084fc';

  // Anillo exterior principal
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, 280, 0, Math.PI * 2); ctx.stroke();

  // Anillo interior secundario
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#f87171';
  ctx.beginPath(); ctx.arc(cx, cy, 260, 0, Math.PI * 2); ctx.stroke();

  // Anillo rúnico fragmentado (guiones)
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
  ctx.setLineDash([20, 15, 5, 15]); // Patrón de runas
  ctx.beginPath(); ctx.arc(cx, cy, 270, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); // Resetear guiones

  // 4. Hexagrama (Estrella de 6 puntas inscrita)
  const r = 280; // Radio del triángulo
  const p1 = { x: cx, y: cy - r }; // Arriba
  const p2 = { x: cx + r * 0.866, y: cy + r * 0.5 }; // Abajo Derecha
  const p3 = { x: cx - r * 0.866, y: cy + r * 0.5 }; // Abajo Izquierda
  
  const ip1 = { x: cx, y: cy + r }; // Invertido Abajo
  const ip2 = { x: cx + r * 0.866, y: cy - r * 0.5 }; // Invertido Arriba Derecha
  const ip3 = { x: cx - r * 0.866, y: cy - r * 0.5 }; // Invertido Arriba Izquierda

  ctx.lineWidth = 3;
  ctx.shadowColor = '#ef4444'; // Resplandor rojo sangre
  ctx.shadowBlur = 15;
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';

  // Triángulo 1 (Normal)
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath(); ctx.stroke();
  // Triángulo 2 (Invertido)
  ctx.beginPath(); ctx.moveTo(ip1.x, ip1.y); ctx.lineTo(ip2.x, ip2.y); ctx.lineTo(ip3.x, ip3.y); ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;

  // 5. Función para dibujar los Altares de los Pokémon
  const drawNode = async (point, poke) => {
    // Pedestal negro con aura carmesí
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 85, 0, Math.PI * 2);
    ctx.fillStyle = '#050505'; // Negro abismo
    ctx.fill();

    // Borde del pedestal
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#b91c1c';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cargar y pintar Sprite con sombra fantasmal
    if (poke.spriteUrl) {
      try {
        const sprite = await loadImage(poke.spriteUrl);
        // Sombra paralela fantasmal púrpura
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;
        ctx.drawImage(sprite, point.x - 65, point.y - 75, 130, 130);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      } catch (e) {
        console.error(`Error sprite sacrificio:`, e);
      }
    }

    // Nombre del sacrificio (Texto tenebroso)
    ctx.fillStyle = '#f87171'; // Rojo claro
    ctx.font = 'bold 22px "Courier New", monospace'; // Fuente tipo máquina/runa
    ctx.textAlign = 'center';
    ctx.letterSpacing = "2px";
    
    // Contorno negro para que resalte
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(poke.nombre.toUpperCase(), point.x, point.y + 115);
    ctx.fillText(poke.nombre.toUpperCase(), point.x, point.y + 115);
  };

  // Pintamos los 3 nodos en el triángulo principal
  await drawNode(p1, pokemones[0]);
  await drawNode(p2, pokemones[1]);
  await drawNode(p3, pokemones[2]);

  // 6. El Vórtice Central y el Huevo Corrompido
  // Resplandor ardiente del fondo
  const vortexGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 150);
  vortexGrad.addColorStop(0, '#ffffff'); // Núcleo al rojo vivo
  vortexGrad.addColorStop(0.2, '#fef08a'); // Fuego amarillo
  vortexGrad.addColorStop(0.5, '#ef4444'); // Fuego rojo
  vortexGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vortexGrad;
  ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2); ctx.fill();

  // El Huevo Oscuro (Corrompido por el sacrificio)
  ctx.shadowColor = '#fca5a5';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 45, 60, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1e1b4b'; // Huevo color obsidiana/púrpura oscuro
  ctx.fill();
  
  // Borde carmesí brillante del huevo
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ef4444';
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Manchas del huevo (Como lava / energía residual)
  ctx.fillStyle = '#f87171'; // Rojo brillante
  ctx.beginPath(); ctx.ellipse(cx - 18, cy + 18, 12, 18, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 25, cy - 15, 10, 15, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy - 35, 15, 8, 0, 0, Math.PI * 2); ctx.fill();

  // 7. Título Superior Tenebroso
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 25;
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('⛤ RITUAL COMPLETADO ⛤', cx, 80);
  ctx.shadowBlur = 0;

  // Subtítulo fantasma
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'italic 20px sans-serif';
  ctx.fillText('Las almas han sido forjadas...', cx, 115);

  return canvas.toBuffer('image/png');
}

async function generarImagenCultivos(cultivos, nombreEntrenador) {
  const colCount = 3; 
  const rowCount = 2; 
  const cardWidth = 260; 
  const cardHeight = 250; 
  const marginX = 30;
  const marginY = 30;
  const headerHeight = 120;

  const canvasWidth = (colCount * cardWidth) + ((colCount + 1) * marginX);
  const canvasHeight = headerHeight + (rowCount * cardHeight) + (rowCount * marginY) + marginY;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // 1. Fondo (Degradado de Granja Mística)
  const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGradient.addColorStop(0, '#0f172a'); // Cielo nocturno profundo
  bgGradient.addColorStop(0.5, '#1e1b4b'); // Púrpura cósmico
  bgGradient.addColorStop(1, '#064e3b'); // Verde bosque profundo
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Partículas ambientales (Luciérnagas/Polen mágico)
  ctx.fillStyle = '#10b981';
  for(let i = 0; i < 60; i++) {
    ctx.globalAlpha = Math.random() * 0.4 + 0.1;
    ctx.beginPath();
    ctx.arc(Math.random() * canvasWidth, Math.random() * canvasHeight, Math.random() * 2 + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // 3. Título Elegante
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`🌾 HUERTO DE ${nombreEntrenador.toUpperCase()} 🌾`, canvasWidth / 2, 60);
  ctx.shadowBlur = 0; 
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.fillText('Supervisa y gestiona a tus Pokémon trabajadores para obtener grandes cosechas.', canvasWidth / 2, 95);

  // 4. Dibujar los Slots
  for (let i = 0; i < 6; i++) {
    const c = cultivos.find(x => x.slot === (i + 1)) || { slot: i + 1, estado: 'vacio' };
    
    const col = i % colCount;
    const row = Math.floor(i / colCount);

    const x = marginX + (col * (cardWidth + marginX));
    const y = headerHeight + (row * (cardHeight + marginY));

    // Panel Base de la Tarjeta (Efecto cristal oscuro)
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#111827'; // Gris casi negro
    drawRoundRect(ctx, x, y, cardWidth, cardHeight, 20, true, false);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Borde de la Tarjeta
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, x, y, cardWidth, cardHeight, 20, false, true);

    // Cabecera Interna (Nombre del Slot)
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`CAMPO ${c.slot}`, x + 20, y + 35);

    // Zona de Tierra (Inner Box)
    const soilX = x + 20;
    const soilY = y + 50;
    const soilW = cardWidth - 40;
    const soilH = 120;

    ctx.textAlign = 'center';

    if (c.estado === 'vacio') {
      // Tierra Seca
      const soilGrad = ctx.createLinearGradient(soilX, soilY, soilX, soilY + soilH);
      soilGrad.addColorStop(0, '#451a03');
      soilGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = soilGrad;
      drawRoundRect(ctx, soilX, soilY, soilW, soilH, 12, true, false);

      ctx.fillStyle = '#fcd34d';
      ctx.font = '45px sans-serif';
      ctx.fillText('🪹', x + cardWidth/2, soilY + 75);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('TERRENO ÁRIDO', x + cardWidth/2, y + 200);
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText('Tierra: #cultivo arar', x + cardWidth/2, y + 225);

    } else if (c.estado === 'preparado') {
      // Tierra Rica / Arada
      const soilGrad = ctx.createLinearGradient(soilX, soilY, soilX, soilY + soilH);
      soilGrad.addColorStop(0, '#291002');
      soilGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = soilGrad;
      drawRoundRect(ctx, soilX, soilY, soilW, soilH, 12, true, false);

      // Líneas de arado hermosas
      ctx.fillStyle = '#1a0a01';
      for(let line = soilY + 25; line < soilY + soilH - 10; line += 22) {
         drawRoundRect(ctx, soilX + 15, line, soilW - 30, 8, 4, true, false);
      }

      ctx.fillStyle = '#6ee7b7';
      ctx.font = '45px sans-serif';
      ctx.fillText('🚜', x + cardWidth/2, soilY + 75);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('LISTO PARA SEMBRAR', x + cardWidth/2, y + 200);
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText('Planta: #cultivo plantar', x + cardWidth/2, y + 225);

    } else if (c.estado === 'plantado') {
      const inicio = new Date(c.fecha_plantado).getTime();
      const duracionMs = 20 * 3600000;
      const reduccionMs = c.reduccion_horas * 3600000;
      const finMs = inicio + duracionMs - reduccionMs;
      const restante = finMs - Date.now();

      let puedeRegar = true;
      if (c.fecha_ultima_regada) {
          const diffRegada = Date.now() - new Date(c.fecha_ultima_regada).getTime();
          if (diffRegada < (4 * 3600000)) puedeRegar = false;
      }

      if (restante <= 0) {
        // === COSECHA LISTA (Efecto Resplandor Dorado) ===
        const soilGrad = ctx.createRadialGradient(x + cardWidth/2, soilY + soilH/2, 10, x + cardWidth/2, soilY + soilH/2, 120);
        soilGrad.addColorStop(0, '#fef08a');
        soilGrad.addColorStop(1, '#854d0e');
        ctx.fillStyle = soilGrad;
        drawRoundRect(ctx, soilX, soilY, soilW, soilH, 12, true, false);

        ctx.shadowColor = '#fef08a';
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#ffffff';
        ctx.font = '65px sans-serif';
        ctx.fillText('🌾', x + cardWidth/2, soilY + 85);
        ctx.shadowBlur = 0; // Resetear sombras

        ctx.fillStyle = '#fcd34d';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('¡COSECHA LISTA!', x + cardWidth/2, y + 200);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText('Usa: #cultivo cosechar', x + cardWidth/2, y + 225);

      } else {
        // === CRECIENDO ===
        const soilGrad = ctx.createLinearGradient(soilX, soilY, soilX, soilY + soilH);
        soilGrad.addColorStop(0, '#166534'); // Verde plantación
        soilGrad.addColorStop(1, '#3f6212');
        ctx.fillStyle = soilGrad;
        drawRoundRect(ctx, soilX, soilY, soilW, soilH, 12, true, false);

        const horas = Math.floor(restante / 3600000);
        const minutos = Math.floor((restante % 3600000) / 60000);

        ctx.fillStyle = '#bef264';
        ctx.font = '55px sans-serif';
        ctx.fillText('🌱', x + cardWidth/2, soilY + 80);

        // Barra de progreso estilizada
        const barW = soilW - 40;
        const barH = 12;
        const barX = soilX + 20;
        const barY = soilY + 95;
        
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        drawRoundRect(ctx, barX, barY, barW, barH, 6, true, false);

        const totalMs = 20 * 3600000; 
        const elapsed = Date.now() - inicio + reduccionMs;
        let percent = elapsed / totalMs;
        if(percent > 1) percent = 1;
        if(percent < 0.05) percent = 0.05; // Que al menos se vea una pizca visual

        ctx.fillStyle = '#84cc16';
        drawRoundRect(ctx, barX, barY, barW * percent, barH, 6, true, false);

        // Notificación visual de regado
        if (puedeRegar) {
            ctx.fillStyle = '#38bdf8';
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('💧', x + cardWidth - 20, y + 38);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#84cc16';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`Creciendo: ${horas}h ${minutos}m`, x + cardWidth/2, y + 200);
        
        ctx.fillStyle = puedeRegar ? '#38bdf8' : '#64748b';
        ctx.font = '14px sans-serif';
        ctx.fillText(puedeRegar ? 'Agua: #cultivo regar' : 'Tierra húmeda y sana', x + cardWidth/2, y + 225);
      }
    }
  }

  return canvas.toBuffer('image/png');
}

async function generarImagenMinas(minas, nombreEntrenador) {
  const colCount = 3; 
  const rowCount = 2; 
  const cardWidth = 260; 
  const cardHeight = 250; 
  const marginX = 30;
  const marginY = 30;
  const headerHeight = 120;

  const canvasWidth = (colCount * cardWidth) + ((colCount + 1) * marginX);
  const canvasHeight = headerHeight + (rowCount * cardHeight) + (rowCount * marginY) + marginY;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // 1. Fondo de cueva profunda
  const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGradient.addColorStop(0, '#1e293b'); 
  bgGradient.addColorStop(0.5, '#0f172a');
  bgGradient.addColorStop(1, '#020617'); 
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Chispas de lava / Polvo de roca
  ctx.fillStyle = '#f97316';
  for(let i = 0; i < 40; i++) {
    ctx.globalAlpha = Math.random() * 0.5 + 0.1;
    ctx.beginPath();
    ctx.arc(Math.random() * canvasWidth, Math.random() * canvasHeight, Math.random() * 2 + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // 3. Título
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`⛰️ CANTERA DE ${nombreEntrenador.toUpperCase()} ⛰️`, canvasWidth / 2, 60);
  ctx.shadowBlur = 0; 
  ctx.fillStyle = '#64748b';
  ctx.font = '18px sans-serif';
  ctx.fillText('Desciende a las profundidades. Requiere fuerza física, precisión y altas temperaturas.', canvasWidth / 2, 95);

  // 4. Dibujar Slots
  for (let i = 0; i < 6; i++) {
    const c = minas.find(x => x.slot === (i + 1)) || { slot: i + 1, estado: 'vacio' };
    
    const col = i % colCount;
    const row = Math.floor(i / colCount);

    const x = marginX + (col * (cardWidth + marginX));
    const y = headerHeight + (row * (cardHeight + marginY));

    // Panel Base
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#1e293b'; 
    drawRoundRect(ctx, x, y, cardWidth, cardHeight, 15, true, false);
    ctx.shadowBlur = 0;

    // Borde
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    drawRoundRect(ctx, x, y, cardWidth, cardHeight, 15, false, true);

    // Cabecera Interna
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`TÚNEL ${c.slot}`, x + 20, y + 35);

    // Zona Interior (Túnel)
    const caveX = x + 20;
    const caveY = y + 50;
    const caveW = cardWidth - 40;
    const caveH = 120;

    ctx.textAlign = 'center';

    const cincoHorasMs = 5 * 3600000;
    const ahoraMs = Date.now();

    if (c.estado === 'vacio') {
      ctx.fillStyle = '#0f172a';
      drawRoundRect(ctx, caveX, caveY, caveW, caveH, 10, true, false);

      ctx.fillStyle = '#475569';
      ctx.font = '45px sans-serif';
      ctx.fillText('🪨', x + cardWidth/2, caveY + 75);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('ROCA SÓLIDA', x + cardWidth/2, y + 200);
      ctx.fillStyle = '#ef4444';
      ctx.font = '14px sans-serif';
      ctx.fillText('Usa: #mina picar', x + cardWidth/2, y + 225);

    } else if (c.estado === 'picado') {
      ctx.fillStyle = '#1e1b4b';
      drawRoundRect(ctx, caveX, caveY, caveW, caveH, 10, true, false);
      
      const inicio = new Date(c.fecha_picado).getTime();
      const restante = (inicio + cincoHorasMs) - ahoraMs;

      if (restante <= 0) {
        ctx.fillStyle = '#8b5cf6'; // Morado místico
        ctx.font = '45px sans-serif';
        ctx.fillText('⛏️', x + cardWidth/2, caveY + 75);

        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('VETA EXPUESTA', x + cardWidth/2, y + 200);
        ctx.fillStyle = '#d97706';
        ctx.font = '14px sans-serif';
        ctx.fillText('Usa: #mina extraer', x + cardWidth/2, y + 225);
      } else {
        const horas = Math.floor(restante / 3600000);
        const minutos = Math.floor((restante % 3600000) / 60000);

        ctx.fillStyle = '#4c1d95';
        ctx.font = '40px sans-serif';
        ctx.fillText('💨', x + cardWidth/2, caveY + 75);

        ctx.fillStyle = '#a78bfa';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`Disipando gas: ${horas}h ${minutos}m`, x + cardWidth/2, y + 200);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.fillText('Fase: Espera', x + cardWidth/2, y + 225);
      }

    } else if (c.estado === 'extraido') {
      const inicio = new Date(c.fecha_extraccion).getTime();
      const restante = (inicio + cincoHorasMs) - ahoraMs;

      ctx.fillStyle = '#2e1065'; // Morado muy oscuro
      drawRoundRect(ctx, caveX, caveY, caveW, caveH, 10, true, false);

      if (restante > 0) {
        const horas = Math.floor(restante / 3600000);
        const minutos = Math.floor((restante % 3600000) / 60000);

        ctx.fillStyle = '#f59e0b';
        ctx.font = '45px sans-serif';
        ctx.fillText('🔥', x + cardWidth/2, caveY + 75);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`Enfriando mineral: ${horas}h ${minutos}m`, x + cardWidth/2, y + 200);
      } else {
        // Listo para forjar, dibujamos las 5 barras de progreso
        ctx.fillStyle = '#38bdf8';
        ctx.font = '40px sans-serif';
        ctx.fillText('💎', x + cardWidth/2, caveY + 60);

        const barW = (caveW - 40) / 5;
        for (let b = 0; b < 5; b++) {
            const bx = caveX + 10 + (b * (barW + 5));
            const by = caveY + 85;
            ctx.fillStyle = b < c.refinados_completados ? '#38bdf8' : 'rgba(0,0,0,0.5)';
            drawRoundRect(ctx, bx, by, barW, 15, 4, true, false);
        }

        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`Forja: ${c.refinados_completados}/5`, x + cardWidth/2, y + 200);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText('Usa: #mina refinar', x + cardWidth/2, y + 225);
      }
    }
  }

  return canvas.toBuffer('image/png');
}

// === ACTUALIZA ESTA LÍNEA AL FINAL ===
module.exports = { generarCollagePokemon, generarImagenVersus, generarSilueta, generarImagenIncubadora, generarImagenPoketeam, generarImagenInventario, generarImagenExpediciones, generarImagenSacrificio, generarImagenCultivos, generarImagenMinas };