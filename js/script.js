const URL_SB = "https://tbiorgavxhsjqxxykrfq.supabase.co"; 
const KEY_SB = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaW9yZ2F2eGhzanF4eHlrcmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMjM4NDksImV4cCI6MjA4MTg5OTg0OX0.n-_1lguGMe0F7GxLj1fT5Y3jXllIyS-5Ehs4pm99lXg";


// 1. Verificação de Configuração
if (!URL_SB || !KEY_SB) {
    console.error("❌ ERRO CRÍTICO: URL_SB ou KEY_SB não definidos.");
    alert("Erro de configuração: Chaves do Supabase ausentes.");
} else {
    console.log(`✅ Supabase inicializado. URL Alvo: ${URL_SB}`);
}

const _supabase = supabase.createClient(URL_SB, KEY_SB, {
    auth: { persistSession: false }
});

let dadosLocais = [];

window.onload = () => carregarDados();

// Função auxiliar para Retry (Tentar Novamente) e Logs
async function sbFetch(tabela, operacao) {
    const max = 3;
    for (let i = 1; i <= max; i++) {
        console.log(`🔄 [Supabase] Acessando '${tabela}' (Tentativa ${i}/${max})...`);
        try {
            const res = await operacao();
            if (!res.error) return res;
            console.warn(`⚠️ Erro na tentativa ${i}:`, res.error.message);
            if (i === max) return res;
        } catch (e) {
            console.error(`❌ Falha de rede na tentativa ${i}:`, e);
            if (i === max) return { data: null, error: e };
        }
        await new Promise(r => setTimeout(r, 1000 * i)); // Espera 1s, 2s, 3s...
    }
}

async function carregarDados() {
    const { data, error } = await sbFetch('receitas', () => 
        _supabase.from('receitas').select('*').order('nome')
    );
    
    if (!error) {
        dadosLocais = data || [];
        renderizar(dadosLocais);
    }
}

function renderizar(lista) {
    const cont = document.getElementById('catalogo');
    if (!cont) return;

    if (lista.length === 0) {
        cont.innerHTML = "<h2 style='text-align:center; padding:50px;'>Nenhuma ficha técnica encontrada. Importe o JSON para começar.</h2>";
        return;
    }

    cont.innerHTML = lista.map(r => `
        <div class="ficha-a4" style="background:white; margin-bottom:20px; padding:20px; border:1px solid #ccc;">
            <img src="${r.img || ''}" onerror="this.src='https://placehold.co/350x150'">
            <div style="display:flex; justify-content:space-between; border-bottom:2px solid black;">
                <h1>${(r.nome || 'SEM NOME').toUpperCase()}</h1>
            </div>
            <p><strong>Categoria:</strong> ${r.cat || '-'}</p>
            <p><strong>Copo:</strong> ${r.copo || '-'}</p>
            <p><strong>Guarnição:</strong> ${r.guar || '-'}</p>
            <p><strong>Ingredientes:</strong> ${Array.isArray(r.ings) ? r.ings.join(', ') : (r.ings || '-')}</p>
            <p><strong>Preparo:</strong> ${Array.isArray(r.prep) ? r.prep.join(' | ') : 'Formato de preparo inválido'}</p>
            <div class="no-print" style="margin-top:15px; border-top:1px solid #eee; padding-top:10px; display:flex; gap:10px;">
                <button onclick="editarReceita('${r.id}')" style="cursor:pointer; padding:5px 10px; background:#f1c40f; border:none; border-radius:4px;">✏️ Editar</button>
                <button onclick="imprimirFicha('${r.id}')" style="cursor:pointer; padding:5px 10px; background:#3498db; color:white; border:none; border-radius:4px;">🖨️ Imprimir</button>
                <button onclick="excluirReceita('${r.id}')" style="cursor:pointer; padding:5px 10px; background:#e74c3c; color:white; border:none; border-radius:4px;">🗑️ Excluir</button>
            </div>
        </div>
    `).join('');
}

async function importarDados(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const conteudo = e.target.result;
            console.log('Iniciando Fetch...');
            // trim() remove espaços em branco no início/fim que causam erro de parse
            const json = JSON.parse(conteudo.trim());
            
            let relatorio = "";

            // 1. RECEITAS (Aceita array direto ou chave 'receitas')
            const listaReceitas = Array.isArray(json) ? json : (json.receitas || []);
            if (listaReceitas.length > 0) {
                const receitasFormatadas = listaReceitas.map(r => ({
                    nome: r.nome,
                    copo: r.copo,
                    cat: r.cat,
                    guar: r.guar,
                    prep: r.prep || r.preparo || [],
                    ings: r.ings || r.ingredientes || r.ingredients || [],
                    img: r.img || r.foto
                }));
                const { error } = await sbFetch('receitas', () => 
                    _supabase.from('receitas').upsert(receitasFormatadas, { onConflict: 'nome' })
                );
                if (error) throw new Error("Erro em Receitas: " + error.message);
                relatorio += `✅ ${listaReceitas.length} receitas importadas.\n`;
            }

            // 2. INSUMOS
            if (json.insumos && Array.isArray(json.insumos)) {
                const { error } = await sbFetch('insumos', () => 
                    _supabase.from('insumos').upsert(json.insumos, { onConflict: 'nome' })
                );
                if (error) throw new Error("Erro em Insumos: " + error.message);
                relatorio += `✅ ${json.insumos.length} insumos importados.\n`;
            }

            // 3. CATEGORIAS
            if (json.categorias && Array.isArray(json.categorias)) {
                const { error } = await sbFetch('categorias', () => 
                    _supabase.from('categorias').upsert(json.categorias, { onConflict: 'nome' })
                );
                if (error) throw new Error("Erro em Categorias: " + error.message);
                relatorio += `✅ ${json.categorias.length} categorias importadas.\n`;
            }

            if (!relatorio) throw new Error("Nenhum dado válido (receitas, insumos ou categorias) encontrado no JSON.");

            alert("Sucesso!\n" + relatorio);
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("ERRO NA IMPORTAÇÃO:\n" + (err.message || err));
        }
    };
    reader.readAsText(file);
}

// --- Funções de Ação (Editar, Imprimir, Excluir) ---

async function excluirReceita(id) {
    if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
    
    const { error } = await _supabase.from('receitas').delete().eq('id', id);
    
    if (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir: " + error.message);
    } else {
        // Atualiza localmente para evitar novo fetch desnecessário
        dadosLocais = dadosLocais.filter(r => r.id != id);
        renderizar(dadosLocais);
        alert("Receita excluída com sucesso!");
    }
}

function imprimirFicha(id) {
    const r = dadosLocais.find(item => item.id == id);
    if (!r) return;

    const janela = window.open('', '_blank', 'width=800,height=600');
    janela.document.write(`
        <html>
        <head>
            <title>Imprimir - ${r.nome}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                .ficha { border: 1px solid #000; padding: 20px; max-width: 210mm; margin: 0 auto; }
                h1 { border-bottom: 2px solid #000; }
                img { max-width: 150px; float: right; }
            </style>
        </head>
        <body>
            <div class="ficha">
                <img src="${r.img || ''}" onerror="this.style.display='none'">
                <h1>${(r.nome || '').toUpperCase()}</h1>
                <p><strong>Copo:</strong> ${r.copo || '-'}</p>
                <p><strong>Categoria:</strong> ${r.cat || '-'}</p>
                <p><strong>Guarnição:</strong> ${r.guar || '-'}</p>
                <h3>Ingredientes</h3>
                <ul>${(r.ings || []).map(i => `<li>${i}</li>`).join('')}</ul>
                <h3>Modo de Preparo</h3>
                <p>${Array.isArray(r.prep) ? r.prep.join('<br>') : r.prep}</p>
            </div>
            <script>
                window.onload = function() { window.print(); window.close(); }
            <\/script>
        </body>
        </html>
    `);
    janela.document.close();
}

function editarReceita(id) {
    const r = dadosLocais.find(item => item.id == id);
    if (!r) return;

    // Preencher campos do editor
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    
    setVal('ed-id', r.id);
    setVal('ed-nome', r.nome || '');
    setVal('ed-copo', r.copo || '');
    setVal('ed-cat', r.cat || '');
    setVal('ed-guar', r.guar || '');
    setVal('ed-img-url', r.img || '');
    
    // Tratar array de preparo para textarea (join com quebra de linha)
    const prepTexto = Array.isArray(r.prep) ? r.prep.join('\n') : r.prep;
    setVal('ed-prep', prepTexto || '');

    // Mostrar editor
    const editor = document.getElementById('editor-container');
    if (editor) editor.style.display = 'block';
}

async function salvarReceitaCompleta() {
    const id = document.getElementById('ed-id').value;
    const nome = document.getElementById('ed-nome').value;
    const copo = document.getElementById('ed-copo').value;
    const cat = document.getElementById('ed-cat').value;
    const guar = document.getElementById('ed-guar').value;
    const prep = document.getElementById('ed-prep').value.split('\n');
    const fileInput = document.getElementById('ed-foto');
    let imgUrl = document.getElementById('ed-img-url').value;

    if (!nome) return alert("Nome é obrigatório");

    // 1. Lógica de Upload
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '');
        
        const { error: uploadError } = await _supabase.storage
            .from('fotos-drinks')
            .upload(fileName, file);

        if (uploadError) return alert("Erro no upload: " + uploadError.message);

        const { data } = _supabase.storage.from('fotos-drinks').getPublicUrl(fileName);
        imgUrl = data.publicUrl;
    }

    // 2. Salvar no Banco
    const receita = { id, nome, copo, cat, guar, prep, img: imgUrl };
    
    if (!id) {
        delete receita.id;
    }

    const { error } = await _supabase.from('receitas').upsert(receita);

    if (error) {
        alert("Erro ao salvar: " + error.message);
    } else {
        alert("Salvo com sucesso!");
        document.getElementById('ed-id').value = "";
        document.getElementById('editor-container').style.display = 'none';
        carregarDados();
    }
}

function filtrar() {
    const termo = document.getElementById('busca').value.toLowerCase();
    const listaFiltrada = dadosLocais.filter(r => {
        const nome = (r.nome || '').toLowerCase();
        const cat = (r.cat || '').toLowerCase();
        const ings = Array.isArray(r.ings) ? r.ings.join(' ').toLowerCase() : (r.ings || '').toLowerCase();
        return nome.includes(termo) || cat.includes(termo) || ings.includes(termo);
    });
    renderizar(listaFiltrada);
}

// Tornando funções globais para acesso via HTML (necessário devido ao type="module")
window.importarDados = importarDados;
window.carregarDados = carregarDados;
window.salvarReceitaCompleta = salvarReceitaCompleta;
window.mudarAba = carregarDados;
window.editarReceita = editarReceita;
window.imprimirFicha = imprimirFicha;
window.excluirReceita = excluirReceita;
window.filtrar = filtrar;