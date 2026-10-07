const minaService = require('../services/minaService');
const usuarioService = require('../services/usuarioService');
const { generarImagenMinas } = require('../services/canvasService');
const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

async function handleMina(msg, texto) {
    const whatsappId = msg.author ? msg.author.split('@')[0] : msg.from.split('@')[0];
    const args = texto.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    const usuario = await usuarioService.obtenerUsuario(whatsappId);
    if (!usuario) return await msg.reply('❌ No estás registrado.');

    // ==========================================
    // 1. VER MINA (Muestra el Canvas)
    // ==========================================
    if (args.length === 1 && cmd === '#mina') {
        const minas = await minaService.obtenerMinas(usuario.id);
        await msg.reply('⛏️ *Descendiendo a las profundidades de la mina...*');

        const tempPath = path.join(__dirname, `../temp_mina_${Date.now()}.png`);

        try {
            const imageBuffer = await generarImagenMinas(minas, usuario.nombre_whatsapp);
            
            // Guardar en disco para evitar que WhatsApp Web falle al procesar Base64 en memoria
            fs.writeFileSync(tempPath, imageBuffer);
            const media = MessageMedia.fromFilePath(tempPath);

            const caption = `⛰️ *CANTERA POKÉMON* ⛰️\n\n` +
                            `Comandos disponibles:\n` +
                            `🥊 *#mina picar [1-6] [pokemon]* (Req: Tipo Lucha)\n` +
                            `🪨 *#mina extraer [1-6] [pokemon]* (Req: Tipo Roca)\n` +
                            `⚙️ *#mina refinar [1-6] [pokemon]* (Req: Tipo Acero - Requiere 5 turnos)`;

            const chat = await msg.getChat();
            await chat.sendMessage(media, { caption });
            return;
        } catch (error) {
            console.error('Error generando mina:', error);
            return await msg.reply('⚠️ Hubo un problema al iluminar la cueva.');
        } finally {
            // Eliminar archivo temporal
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    // ==========================================
    // 2. PICAR / EXTRAER / REFINAR
    // ==========================================
    if (args.length >= 3 && ['picar', 'extraer', 'refinar'].includes(args[1].toLowerCase())) {
        const accion = args[1].toLowerCase();
        const slot = parseInt(args[2]);
        const nombrePokemon = args.length >= 4 ? args.slice(3).join(' ') : '';
        const fueAutomatico = nombrePokemon === '';

        if (isNaN(slot) || slot < 1 || slot > 6) return await msg.reply('❌ Indica un túnel válido del 1 al 6. Ej: *#mina picar 1*');

        const res = await minaService.procesarAccionMina(whatsappId, slot, nombrePokemon, accion);

        if (res.error) {
            if (res.error === 'pokemon_no_encontrado') return await msg.reply(`❌ No tienes ningún *${nombrePokemon}* registrado.`);
            if (res.error === 'cooldown_pokemon') return await msg.reply(`💤 *${nombrePokemon}* está exhausto por el trabajo pesado en la mina. Déjalo descansar *${res.horas}h ${res.mins}m* más.`);
            if (res.error === 'tipos_multiples') return await msg.reply(`❌ La minería requiere concentración. ¡Solo se admiten Pokémon de tipo PURO!`);
            if (res.error === 'tipo_incorrecto') {
                const reqMap = { 'picar': 'Lucha (Fighting)', 'extraer': 'Roca (Rock)', 'refinar': 'Acero (Steel)' };
                return await msg.reply(`❌ Tipo incorrecto. Para *${accion}* necesitas un Pokémon de tipo puro *${reqMap[accion]}*.`);
            }
            if (res.error === 'ninguno_disponible') {
                const reqMap = { 'fighting': 'Lucha', 'rock': 'Roca', 'steel': 'Acero' };
                return await msg.reply(`❌ *Automatización fallida:* No tienes ningún Pokémon de tipo PURO *${reqMap[res.tipoReq]}* descansado y disponible para trabajar.\nRevisa tu caja con: *#pokedex mina*`);
            }
            if (res.error === 'estado_incorrecto') return await msg.reply(`❌ El túnel ${slot} no está en la fase correcta para *${accion}*. Revisa la mina con #mina.`);
            if (res.error === 'espera_fase') return await msg.reply(`⏳ Aún no han pasado las 5 horas requeridas para avanzar a esta fase.`);
            
            return await msg.reply('⚠️ Error procesando la acción minera.');
        }

        if (res.success) {
            let texto = '';
            if (accion === 'picar') texto = `🥊 *${res.pokemon}* ha roto las rocas del Túnel ${slot}. ¡Los gases tóxicos deben disiparse! Podrás extraer en *5 horas*.`;
            if (accion === 'extraer') texto = `🪨 *${res.pokemon}* ha extraído el mineral crudo del Túnel ${slot}. Se debe enfriar durante *5 horas* antes de refinarlo.`;
            if (accion === 'refinar') {
                if (res.recompensa > 0) {
                    texto = `🎉 ¡Proceso finalizado!\n\n⚙️ *${res.pokemon}* dio el último toque en la forja. Has obtenido *${res.recompensa}x Herramientas* 🛠️ y el Túnel ${slot} está libre de nuevo.`;
                } else {
                    texto = `⚙️ *${res.pokemon}* ha trabajado duro refinando el mineral del Túnel ${slot}.\nProgreso de forja: *(${res.refinadosTotales}/5)*. ¡Falta menos!`;
                }
            }

            if (fueAutomatico) {
                const { getImagen } = require('../services/pokeapi');
                const urlImagen = getImagen({ id: res.pokeId });
                if (urlImagen) {
                    const media = MessageMedia.fromFilePath(urlImagen);
                    const chat = await msg.getChat();
                    return await chat.sendMessage(media, { caption: texto });
                }
            }
            return await msg.reply(texto);
        }
    }
}

module.exports = { handleMina };