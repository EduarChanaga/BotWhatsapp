const db = require('./database');
const { consultarPokemon } = require('./pokeapi');

async function obtenerCultivos(usuarioId) {
    let [rows] = await db.execute('SELECT * FROM cultivos WHERE usuario_id = ? ORDER BY slot ASC', [usuarioId]);
    if (rows.length === 0) {
        for (let i = 1; i <= 6; i++) {
            await db.execute('INSERT INTO cultivos (usuario_id, slot) VALUES (?, ?)', [usuarioId, i]);
        }
        [rows] = await db.execute('SELECT * FROM cultivos WHERE usuario_id = ? ORDER BY slot ASC', [usuarioId]);
    }
    return rows;
}

// Validación con soporte automático
async function validarPokemonTrabajo(connection, whatsappId, nombrePokemon, tipoRequerido) {
    let nombreBase = (nombrePokemon || '').trim();
    
    // Si el usuario especificó un nombre, buscamos a ese Pokémon en específico
    if (nombreBase !== '') {
        let offset = 0;
        const match = nombreBase.match(/^(.+)_(\d+)$/);
        if (match) {
            nombreBase = match[1].trim();
            const indice = parseInt(match[2], 10);
            offset = indice > 0 ? indice - 1 : 0;
        }

        const limitClause = offset > 0 ? `LIMIT 1 OFFSET ${offset}` : `LIMIT 1`;

        let [pokeRows] = await connection.execute(`
            SELECT pa.*, u.id as uid FROM pokemon_atrapados pa JOIN usuarios u ON pa.usuario_id = u.id 
            WHERE u.whatsapp_id = ? AND LOWER(pa.nombre) = LOWER(?) ORDER BY pa.id ASC ${limitClause}
        `, [whatsappId, nombreBase]);

        if (pokeRows.length === 0 && !isNaN(nombreBase)) {
            [pokeRows] = await connection.execute(`
                SELECT pa.*, u.id as uid FROM pokemon_atrapados pa JOIN usuarios u ON pa.usuario_id = u.id 
                WHERE u.whatsapp_id = ? AND pa.pokemon_id = ? ORDER BY pa.id ASC ${limitClause}
            `, [whatsappId, nombreBase]);
        }

        if (pokeRows.length === 0) {
            const inputFlexible = `%${nombreBase}%`;
            [pokeRows] = await connection.execute(`
                SELECT pa.*, u.id as uid FROM pokemon_atrapados pa JOIN usuarios u ON pa.usuario_id = u.id 
                WHERE u.whatsapp_id = ? AND LOWER(pa.nombre) LIKE LOWER(?) ORDER BY pa.id ASC ${limitClause}
            `, [whatsappId, inputFlexible]);
        }

        if (pokeRows.length === 0) return { error: 'pokemon_no_encontrado' };
        const poke = pokeRows[0];

        if (poke.fecha_ultimo_trabajo) {
            const diff = Date.now() - new Date(poke.fecha_ultimo_trabajo).getTime();
            if (diff < 3600000) return { error: 'cooldown_pokemon', mins: Math.floor((3600000 - diff) / 60000) };
        }

        const dataApi = await consultarPokemon(poke.pokemon_id);
        if (!dataApi || !dataApi.types) return { error: 'api_error' };
        if (dataApi.types.length > 1) return { error: 'tipos_multiples' };
        if (dataApi.types[0].type.name !== tipoRequerido) return { error: 'tipo_incorrecto', tipoReq: tipoRequerido };

        return { poke };
    } 
    // MODO AUTOMÁTICO: Buscar al mejor Pokémon disponible que cumpla los requisitos
    else {
        const [pokeRows] = await connection.execute(`
            SELECT pa.*, u.id as uid FROM pokemon_atrapados pa JOIN usuarios u ON pa.usuario_id = u.id 
            WHERE u.whatsapp_id = ? ORDER BY pa.nivel DESC, pa.id ASC
        `, [whatsappId]);

        const ahoraMs = Date.now();
        for (const poke of pokeRows) {
            // Validar Cooldown (1 Hora)
            if (poke.fecha_ultimo_trabajo) {
                const diff = ahoraMs - new Date(poke.fecha_ultimo_trabajo).getTime();
                if (diff < 3600000) continue; 
            }
            // Validar Tipo
            const dataApi = await consultarPokemon(poke.pokemon_id);
            if (!dataApi || !dataApi.types) continue;
            if (dataApi.types.length === 1 && dataApi.types[0].type.name === tipoRequerido) {
                return { poke }; // Retornamos el primero disponible
            }
        }
        return { error: 'ninguno_disponible', tipoReq: tipoRequerido };
    }
}

async function procesarAccionCultivo(whatsappId, slot, nombrePokemon, accion) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [userRows] = await connection.execute('SELECT id FROM usuarios WHERE whatsapp_id = ?', [whatsappId]);
        if (userRows.length === 0) { await connection.rollback(); return { error: 'no_registrado' }; }
        const usuarioId = userRows[0].id;

        const [campoRows] = await connection.execute('SELECT * FROM cultivos WHERE usuario_id = ? AND slot = ? FOR UPDATE', [usuarioId, slot]);
        if (campoRows.length === 0) { await connection.rollback(); return { error: 'campo_invalido' }; }
        const campo = campoRows[0];

        let tipoRequerido = '';
        if (accion === 'arar') tipoRequerido = 'ground';
        if (accion === 'plantar') tipoRequerido = 'grass';
        if (accion === 'regar') tipoRequerido = 'water';

        const val = await validarPokemonTrabajo(connection, whatsappId, nombrePokemon, tipoRequerido);
        if (val.error) { await connection.rollback(); return val; }
        const poke = val.poke;

        if (accion === 'arar') {
            if (campo.estado !== 'vacio') { await connection.rollback(); return { error: 'estado_incorrecto' }; }
            await connection.execute('UPDATE cultivos SET estado = "preparado" WHERE id = ?', [campo.id]);
        } else if (accion === 'plantar') {
            if (campo.estado !== 'preparado') { await connection.rollback(); return { error: 'estado_incorrecto' }; }
            const [inv] = await connection.execute('SELECT semilla FROM inventario WHERE usuario_id = ? FOR UPDATE', [usuarioId]);
            if (!inv[0] || inv[0].semilla <= 0) { await connection.rollback(); return { error: 'sin_semillas' }; }
            
            await connection.execute('UPDATE inventario SET semilla = semilla - 1 WHERE usuario_id = ?', [usuarioId]);
            await connection.execute('UPDATE cultivos SET estado = "plantado", fecha_plantado = NOW(), reduccion_horas = 0, fecha_ultima_regada = NULL WHERE id = ?', [campo.id]);
        } else if (accion === 'regar') {
            if (campo.estado !== 'plantado') { await connection.rollback(); return { error: 'estado_incorrecto' }; }
            if (campo.fecha_ultima_regada) {
                const diffRegada = Date.now() - new Date(campo.fecha_ultima_regada).getTime();
                if (diffRegada < (4 * 3600000)) {
                    await connection.rollback(); return { error: 'cooldown_regar', horasFaltan: Math.ceil((4 * 3600000 - diffRegada)/3600000) };
                }
            }
            await connection.execute('UPDATE cultivos SET reduccion_horas = reduccion_horas + 2, fecha_ultima_regada = NOW() WHERE id = ?', [campo.id]);
        }

        await connection.execute('UPDATE pokemon_atrapados SET fecha_ultimo_trabajo = NOW() WHERE id = ?', [poke.id]);
        await connection.commit();
        
        // Devolvemos pokeId para poder sacar la foto
        return { success: true, accion: accion, pokemon: poke.nombre, pokeId: poke.pokemon_id };

    } catch (error) {
        await connection.rollback();
        console.error('Error procesando cultivo:', error);
        return { error: 'db_error' };
    } finally {
        connection.release();
    }
}

async function cosecharCampo(whatsappId, slot) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [userRows] = await connection.execute('SELECT id FROM usuarios WHERE whatsapp_id = ?', [whatsappId]);
        if (userRows.length === 0) { await connection.rollback(); return { error: 'no_registrado' }; }
        const usuarioId = userRows[0].id;

        const [campoRows] = await connection.execute('SELECT * FROM cultivos WHERE usuario_id = ? AND slot = ? FOR UPDATE', [usuarioId, slot]);
        const campo = campoRows[0];

        if (!campo || campo.estado !== 'plantado') { await connection.rollback(); return { error: 'no_plantado' }; }

        const inicio = new Date(campo.fecha_plantado).getTime();
        const duracionMs = 20 * 3600000;
        const reduccionMs = campo.reduccion_horas * 3600000;
        if (Date.now() < (inicio + duracionMs - reduccionMs)) {
            await connection.rollback(); return { error: 'no_listo' };
        }

        const cantidadObtenida = 1;
        const [invCheck] = await connection.execute('SELECT id FROM inventario WHERE usuario_id = ?', [usuarioId]);
        if (invCheck.length === 0) {
            await connection.execute('INSERT INTO inventario (usuario_id, cultivos) VALUES (?, ?)', [usuarioId, cantidadObtenida]);
        } else {
            await connection.execute('UPDATE inventario SET cultivos = cultivos + ? WHERE usuario_id = ?', [cantidadObtenida, usuarioId]);
        }

        await connection.execute('UPDATE cultivos SET estado = "vacio", fecha_plantado = NULL, fecha_ultima_regada = NULL, reduccion_horas = 0 WHERE id = ?', [campo.id]);
        await connection.commit();
        return { success: true, cantidad: cantidadObtenida };
    } catch (error) {
        await connection.rollback();
        return { error: 'db_error' };
    } finally {
        connection.release();
    }
}

module.exports = { obtenerCultivos, procesarAccionCultivo, cosecharCampo };