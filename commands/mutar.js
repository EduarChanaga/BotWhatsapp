const { consultarPokemon, getVariantesPokemon } = require('../services/pokeapi');
const pokemonService = require('../services/pokemonService');

// Función auxiliar para comparar las estadísticas (stats)
function sonStatsIguales(statsA, statsB) {
  if (!statsA || !statsB || statsA.length !== statsB.length) return false;
  for (let i = 0; i < statsA.length; i++) {
    if (statsA[i].base_stat !== statsB[i].base_stat) return false;
  }
  return true;
}

async function handleMutar(msg, texto) {
  const partes = texto.replace('#mutar', '').trim().split(' ');
  if (partes.length < 2) return await msg.reply('⚠️ *Uso:* #mutar [nombre_pokemon] [nombre_nueva_forma]');

  const nombrePokemon = partes[0];
  const nombreNuevaForma = partes.slice(1).join('-'); 

  const whatsappId = msg.author ? msg.author.split('@')[0] : msg.from.split('@')[0];
  
  const pokemon = await pokemonService.verificarYObtenerPokemon(whatsappId, nombrePokemon);

  if (!pokemon) return await msg.reply('❌ No tienes un Pokémon con ese nombre.');

  // 1. Obtener datos actuales de la API y todas sus variantes
  const data = await consultarPokemon(pokemon.pokemon_id);
  const todasLasVariantes = await getVariantesPokemon(data);

  const nombreActualAPI = data.name.toLowerCase();
  const esMegaActual = nombreActualAPI.includes('mega');

  // 2. Búsqueda ultra flexible en TODAS las variantes
  const formaEncontrada = todasLasVariantes.find(v => {
    const vNormalizado = v.toLowerCase().replace(/-/g, ' ');
    const inputNormalizado = nombreNuevaForma.toLowerCase().replace(/-/g, ' ');
    const pokemonBase = pokemon.nombre.toLowerCase().replace(/-/g, ' ');
    
    return vNormalizado === inputNormalizado || 
           vNormalizado === `${pokemonBase} ${inputNormalizado}`;
  });

  if (!formaEncontrada) {
    // Escondemos visualmente las Megas en el mensaje de error para no confundir
    const variantesVisuales = todasLasVariantes.filter(v => !v.includes('mega'));
    return await msg.reply(
        `❌ Variante inválida o mal escrita para *${pokemon.nombre}*.\n` +
        `Opciones disponibles por ADN/Estética: ${variantesVisuales.map(v => v.replace(/-/g, ' ')).join(', ')}`
    );
  }

  // 3. Validaciones específicas de formas supremas (SOLO MEGA)
  const esMegaDestino = formaEncontrada.toLowerCase().includes('mega');

  if (esMegaDestino && !esMegaActual) {
      return await msg.reply(`🛑 La forma *${formaEncontrada.replace(/-/g, ' ')}* es una Mega Evolución.\n\n👉 Necesitas usar el comando: *#use mega_energia ${pokemon.nombre} ${formaEncontrada}*`);
  }

  // 4. Obtener los datos completos de la nueva forma seleccionada
  const dataNueva = await consultarPokemon(formaEncontrada);

  // 5. LÓGICA: Comparar stats y validar el desbloqueo permanente del ADN
  const statsSonIguales = sonStatsIguales(data.stats, dataNueva.stats);
  const tieneAdnActivado = pokemon.punta_adn === 1 || pokemon.punta_adn === true;

  // REGLA PARA GMAX (Solo bloquea si altera stats)
  if (formaEncontrada.toLowerCase().includes('max') && !statsSonIguales) {
      return await msg.reply(`🛑 Esta forma Gigantamax (*${formaEncontrada.replace(/-/g, ' ')}*) altera enormemente el poder de combate.\n\n👉 Necesitas usar el comando: *#use mega_energia ${pokemon.nombre} ${formaEncontrada}*`);
  }

  // Regla estándar: Si cambian las stats (Primales, Regionales, etc) y NO tiene ADN, bloqueamos
  if (!statsSonIguales && !tieneAdnActivado) {
    return await msg.reply(`🧬 La nueva variante altera las estadísticas de combate y tu Pokémon no tiene el ADN preparado.\n👉 Si tienes una Punta ADN en tu inventario, aplícasela primero usando: *#use punta_adn ${pokemon.nombre}*`);
  }

  // 6. Ejecutar cambio
  const exito = await pokemonService.cambiarVariantePokemon(pokemon.id, dataNueva.id, formaEncontrada);

  if (exito) {
    const tipoMutacion = statsSonIguales ? '(Mutación Estética)' : '(Mutación de Combate)';
    const nombreLimpio = formaEncontrada.replace(/-/g, ' ').toUpperCase();
    
    let mensajeExito = `✨ ¡Éxito! *${pokemon.nombre}* ha mutado a *${nombreLimpio}* ${tipoMutacion}.`;
    if (!statsSonIguales) {
      mensajeExito += `\n🧬 _El ADN adaptativo sigue activo en este Pokémon._`;
    }
    
    await msg.reply(mensajeExito);
  } else {
    await msg.reply('⚠️ Error al aplicar la mutación.');
  }
}

module.exports = { handleMutar };