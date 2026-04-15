// Control Todos API - Netlify Function
// CRUD for todo tasks with notes

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD_HASH = 'be50e4db19df4d208d3a3440926126de8806191de1818f9e251a80cab62fbb75';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://electrautoquebec.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
};

async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAuth(authHeader) {
    if (!authHeader) return false;
    const password = authHeader.replace('Bearer ', '');
    const hash = await sha256(password);
    return hash === PASSWORD_HASH;
}

async function supaFetch(endpoint, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        method: options.method || 'GET',
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${res.status}: ${text}`);
    }
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('json')) return res.json();
    return null;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const authed = await verifyAuth(event.headers.authorization);
    if (!authed) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        const params = event.queryStringParameters || {};

        // GET - list todos or single todo with notes
        if (event.httpMethod === 'GET') {
            // Single todo with notes
            if (params.id) {
                const todos = await supaFetch(`control_todos?id=eq.${params.id}&limit=1`);
                if (!todos || todos.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
                }
                const todo = todos[0];

                // Get notes
                const notes = await supaFetch(`control_todo_notes?todo_id=eq.${params.id}&order=created_at.desc`);

                // Get employee names
                const empIds = new Set();
                if (todo.created_by) empIds.add(todo.created_by);
                if (todo.assigned_to) empIds.add(todo.assigned_to);
                if (todo.completed_by) empIds.add(todo.completed_by);

                let empMap = {};
                if (empIds.size > 0) {
                    const emps = await supaFetch(`control_employees?id=in.(${[...empIds].join(',')})&select=id,first_name,last_name`);
                    emps.forEach(e => { empMap[e.id] = e; });
                }

                // Get vehicle info
                let vehicle = null;
                if (todo.vehicle_id) {
                    const vehs = await supaFetch(`control_vehicles?id=eq.${todo.vehicle_id}&select=id,make,model,year,plate,owner_name&limit=1`);
                    if (vehs && vehs.length > 0) vehicle = vehs[0];
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ ...todo, notes: notes || [], employees: empMap, vehicle })
                };
            }

            // Count only
            if (params.count === 'true') {
                const active = await supaFetch('control_todos?completed_at=is.null&select=id', { prefer: 'count=exact' });
                return { statusCode: 200, headers, body: JSON.stringify({ count: active ? active.length : 0 }) };
            }

            // List all todos
            const completed = params.completed === 'true';
            let query = completed
                ? 'control_todos?completed_at=not.is.null&order=completed_at.desc&limit=50'
                : 'control_todos?completed_at=is.null&order=priority.asc,due_date.asc.nullslast,created_at.desc';

            const todos = await supaFetch(query);

            // Collect all employee IDs and vehicle IDs
            const empIds = new Set();
            const vehIds = new Set();
            todos.forEach(t => {
                if (t.created_by) empIds.add(t.created_by);
                if (t.assigned_to) empIds.add(t.assigned_to);
                if (t.completed_by) empIds.add(t.completed_by);
                if (t.vehicle_id) vehIds.add(t.vehicle_id);
            });

            let empMap = {};
            if (empIds.size > 0) {
                const emps = await supaFetch(`control_employees?id=in.(${[...empIds].join(',')})&select=id,first_name,last_name`);
                emps.forEach(e => { empMap[e.id] = e; });
            }

            let vehMap = {};
            if (vehIds.size > 0) {
                const vehs = await supaFetch(`control_vehicles?id=in.(${[...vehIds].join(',')})&select=id,make,model,year,plate`);
                vehs.forEach(v => { vehMap[v.id] = v; });
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ todos, employees: empMap, vehicles: vehMap })
            };
        }

        // POST - create todo or add note
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            // Add note to a todo
            if (body.action === 'add_note') {
                if (!body.todo_id || !body.text) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing todo_id or text' }) };
                }
                const note = await supaFetch('control_todo_notes', {
                    method: 'POST',
                    body: { todo_id: body.todo_id, text: body.text.trim().substring(0, 1000) }
                });
                return { statusCode: 201, headers, body: JSON.stringify(note[0]) };
            }

            // Create todo
            if (!body.title) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing title' }) };
            }
            const todo = {
                title: body.title.trim().substring(0, 500),
                description: (body.description || '').trim().substring(0, 2000),
                priority: Math.max(1, Math.min(3, parseInt(body.priority) || 2)),
                category: body.category || 'Autre',
                created_by: body.created_by || null,
                assigned_to: body.assigned_to || null,
                vehicle_id: body.vehicle_id || null,
                due_date: body.due_date || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const data = await supaFetch('control_todos', { method: 'POST', body: todo });
            return { statusCode: 201, headers, body: JSON.stringify(data[0]) };
        }

        // PATCH - update todo or complete
        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body);
            if (!body.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
            }

            // Complete a todo
            if (body.action === 'complete') {
                const updates = {
                    completed_by: body.completed_by || null,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                const data = await supaFetch(`control_todos?id=eq.${body.id}`, { method: 'PATCH', body: updates });
                return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
            }

            // Reopen a todo
            if (body.action === 'reopen') {
                const updates = {
                    completed_by: null,
                    completed_at: null,
                    updated_at: new Date().toISOString()
                };
                const data = await supaFetch(`control_todos?id=eq.${body.id}`, { method: 'PATCH', body: updates });
                return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
            }

            // Edit todo
            const updates = { updated_at: new Date().toISOString() };
            if (body.title !== undefined) updates.title = body.title.trim().substring(0, 500);
            if (body.description !== undefined) updates.description = (body.description || '').trim().substring(0, 2000);
            if (body.priority !== undefined) updates.priority = Math.max(1, Math.min(3, parseInt(body.priority) || 2));
            if (body.category !== undefined) updates.category = body.category;
            if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to || null;
            if (body.vehicle_id !== undefined) updates.vehicle_id = body.vehicle_id || null;
            if (body.due_date !== undefined) updates.due_date = body.due_date || null;

            const data = await supaFetch(`control_todos?id=eq.${body.id}`, { method: 'PATCH', body: updates });
            return { statusCode: 200, headers, body: JSON.stringify(data[0]) };
        }

        // DELETE
        if (event.httpMethod === 'DELETE') {
            if (params.note_id) {
                await supaFetch(`control_todo_notes?id=eq.${params.note_id}`, { method: 'DELETE' });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            if (!params.id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
            }
            await supaFetch(`control_todos?id=eq.${params.id}`, { method: 'DELETE' });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (err) {
        console.error('control-todos error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
