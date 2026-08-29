const pokemonService = require('../services/pokemonService');
const { consultarPokemon, getStat, getImagen, getTiposEspanol, getHabilidadesEspanol } = require('../services/pokeapi');
const { MessageMedia } = require('whatsapp-web.js');
const { generarFichaPokemon } = require('../services/canvasService');

async function handlePokemonStats(msg) {
  try {
    const whatsappId = (msg.author || msg.from).split('@')[0].split(':')[0];
    const nombreBuscado = msg.body.replace(/^#pokemonstats/i, '').trim();
    
    if (!nombreBuscado) {
      return await msg.reply('❌ Especifica el nombre del Pokémon que deseas consultar.\n👉 Ejemplo: `#pokemonstats Pikachu`');
    }

    const pokeDB = await pokemonService.verificarYObtenerPokemon(whatsappId, nombreBuscado);
    
    if (!pokeDB) {
      return await msg.reply(`❌ No tienes ningún *${nombreBuscado}* registrado en tu Pokédex.`);
    }

    let dataApi;
    try {
      dataApi = await consultarPokemon(pokeDB.pokemon_id);
    } catch (apiError) {
      return await msg.reply('⚠️ Error al conectar con la PokéAPI para traer las estadísticas base.');
    }

    if (!dataApi || typeof dataApi !== 'object') {
      return await msg.reply('⚠️ No se pudo obtener la información del Pokémon desde la PokéAPI.');
    }

    const pokedexId = dataApi.id || pokeDB.pokemon_id;
    
    // 1. Obtenemos las estadísticas base puras
    const stats = {
      hp: getStat(dataApi, 'hp') || 0,
      atk: getStat(dataApi, 'attack') || 0,
      def: getStat(dataApi, 'defense') || 0,
      vel: getStat(dataApi, 'speed') || 0,
      spAtk: getStat(dataApi, 'special-attack') || 0,
      spDef: getStat(dataApi, 'special-defense') || 0,
    };

    // 2. Calculamos el multiplicador según el nivel actual del Pokémon
    const nivelActual = pokeDB.nivel || 1;
    const xpNecesariaSiguienteNivel = 100 + ((nivelActual - 1) * 25);
    const xpFaltante = Math.max(0, xpNecesariaSiguienteNivel - (pokeDB.experiencia || 0));
    const multNivel = 1 + (nivelActual - 1) * 0.05;

    // 3. Calculamos los totales usando las fórmulas de tu sistema de combate
    const hpTotal = Math.floor(stats.hp * 2 * multNivel);
    const atkTotal = Math.floor(stats.atk * multNivel);
    const defTotal = Math.floor(stats.def * multNivel);
    const spAtkTotal = Math.floor(stats.spAtk * multNivel);
    const spDefTotal = Math.floor(stats.spDef * multNivel);
    const velTotal = Math.floor(stats.vel * multNivel);

    let probEsquive = (stats.vel / 20) + (nivelActual > 1 ? nivelActual - 1 : 0);
    if (probEsquive > 30) probEsquive = 30;

    const formatearFecha = (fecha) => fecha ? new Date(fecha).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) : null;
    const fechaFormateada = formatearFecha(pokeDB.atrapado_en);

    const tipos = await Promise.resolve(getTiposEspanol(dataApi));

    const habilidades = await getHabilidadesEspanol(dataApi);
    const ficha = await generarFichaPokemon(dataApi, {
      nombre: pokeDB.nombre, tipos, nivel: nivelActual, experiencia: pokeDB.experiencia || 0, xpFaltante,
      combates: pokeDB.combates || 0, fechaCaptura: fechaFormateada,
      fechaEntrenamiento: formatearFecha(pokeDB.fecha_entrenamiento),
      fechaTrabajo: formatearFecha(pokeDB.fecha_ultimo_trabajo), habilidades, probEsquive,
      imagen: getImagen(dataApi),
      totales: { hp: hpTotal, atk: atkTotal, def: defTotal, spAtk: spAtkTotal, spDef: spDefTotal, vel: velTotal }, stats,
    });
    const media = new MessageMedia('image/png', ficha.toString('base64'), `pokedex_${pokedexId}.png`);
    await msg.reply(media, undefined, { quotedMessageId: msg.id._serialized });

  } catch (error) {
    console.error('Error en handlePokemonStats:', error);
    await msg.reply('⚠️ Hubo un error interno al compilar las estadísticas de tu Pokémon.');
  }
}

module.exports = { handlePokemonStats };