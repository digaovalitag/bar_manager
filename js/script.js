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
    } else {
        console.error("Erro ao carregar dados:", error);
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
        <div class="drink-card">
            <div class="ficha-info">
                <h1>${(r.nome || 'SEM NOME').toUpperCase()}</h1>
                <p><strong>CATEGORIA:</strong> ${r.cat || '-'} | <strong>COPO:</strong> ${r.copo || '-'}</p>
                <p><strong>GUARNIÇÃO:</strong> ${r.guar || '-'}</p>
                
                <h3>INGREDIENTES</h3>
                <ul>
                    ${Array.isArray(r.ings) ? r.ings.map(i => `<li>${i}</li>`).join('') : `<li>${r.ings || '-'}</li>`}
                </ul>

                <h3>MODO DE PREPARO</h3>
                <div>
                    ${Array.isArray(r.prep) ? r.prep.map((p, i) => `<p><strong>${i+1}.</strong> ${p}</p>`).join('') : (r.prep || '-')}
                </div>

                <div class="no-print" style="margin-top:20px; display:flex; gap:10px;">
                    <button onclick="editarReceita('${r.id}')" style="cursor:pointer; padding:8px 12px; background:#f1c40f; border:none; border-radius:4px;">✏️ Editar</button>
                    <button onclick="imprimirFicha('${r.id}')" style="cursor:pointer; padding:8px 12px; background:#3498db; color:white; border:none; border-radius:4px;">🖨️ Imprimir</button>
                    <button onclick="excluirReceita('${r.id}')" style="cursor:pointer; padding:8px 12px; background:#e74c3c; color:white; border:none; border-radius:4px;">🗑️ Excluir</button>
                </div>
            </div>
            
            <div class="foto-container">
                <img src="${r.img || ''}" style="transform: scale(${r.zoom || 1}); transform-origin: center;" onerror="this.src='https://placehold.co/300'">
            </div>
        </div>
    `).join('');
}

/**
 * Função Blindada de Limpeza de Dados
 * Recebe um objeto bruto e retorna APENAS as colunas permitidas.
 * Remove explicitamente o ID para evitar conflitos de Identity.
 */
function limparObjetoReceita(item) {
    // 1. Mapeamento de campos (JSON -> Banco)
    const prep = item.prep || item.preparo || [];
    const ings = item.ings || item.ingredientes || item.ingredients || [];
    const img = item.img || item.foto;

    // 2. Criação do objeto limpo (Whitelist)
    const dadosLimpos = {
        nome: item.nome,
        cat: item.cat,
        copo: item.copo,
        guar: item.guar,
        ings: ings,
        prep: prep,
        img: img,
        zoom: item.zoom || 1
    };

    // 3. Garantia final: Destructuring para remover ID se ele tiver passado de alguma forma
    // (Embora o objeto acima já não tenha ID, isso segue a instrução rigorosa)
    const { id, ...final } = dadosLimpos;
    return final;
}

async function importarDados(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const conteudo = e.target.result;
            const json = JSON.parse(conteudo.trim());
            let relatorio = "";

            // 1. RECEITAS
            const listaReceitas = Array.isArray(json) ? json : (json.receitas || []);
            if (listaReceitas.length > 0) {
                // Mapeia e limpa cada item
                const receitasFormatadas = listaReceitas.map(r => limparObjetoReceita(r));

                console.log("📤 Enviando para Supabase (Amostra):", receitasFormatadas[0]);

                const { error } = await sbFetch('receitas', () => 
                    _supabase.from('receitas').upsert(receitasFormatadas, { onConflict: 'nome' })
                );
                
                if (error) {
                    console.error("❌ Erro DETALHADO na importação de Receitas:", error);
                    throw new Error(`Erro Supabase: ${error.message} (Code: ${error.code})`);
                }
                relatorio += `✅ ${listaReceitas.length} receitas importadas.\n`;
            }

            // 2. INSUMOS e 3. CATEGORIAS (Mantidos simples)
            if (json.insumos && Array.isArray(json.insumos)) {
                const { error } = await sbFetch('insumos', () => 
                    _supabase.from('insumos').upsert(json.insumos, { onConflict: 'nome' })
                );
                if (error) throw new Error("Erro em Insumos: " + error.message);
                relatorio += `✅ ${json.insumos.length} insumos importados.\n`;
            }

            if (json.categorias && Array.isArray(json.categorias)) {
                const { error } = await sbFetch('categorias', () => 
                    _supabase.from('categorias').upsert(json.categorias, { onConflict: 'nome' })
                );
                if (error) throw new Error("Erro em Categorias: " + error.message);
                relatorio += `✅ ${json.categorias.length} categorias importadas.\n`;
            }

            if (!relatorio) throw new Error("Nenhum dado válido encontrado.");

            alert("Sucesso!\n" + relatorio);
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("ERRO NA IMPORTAÇÃO:\n" + (err.message || err));
        }
    };
    reader.readAsText(file);
}

async function excluirReceita(id) {
    if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
    const { error } = await _supabase.from('receitas').delete().eq('id', id);
    if (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir: " + error.message);
    } else {
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
            <script>window.onload = function() { window.print(); window.close(); }<\/script>
        </body>
        </html>
    `);
    janela.document.close();
}

function editarReceita(id) {
    const r = dadosLocais.find(item => item.id == id);
    if (!r) return;

    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    
    setVal('ed-id', r.id);
    setVal('ed-nome', r.nome || '');
    setVal('ed-copo', r.copo || '');
    setVal('ed-cat', r.cat || '');
    setVal('ed-guar', r.guar || '');
    setVal('ed-img-url', r.img || '');
    setVal('ed-zoom', r.zoom || 1);

    const preview = document.getElementById('ed-preview');
    if (preview) {
        preview.src = r.img || 'https://placehold.co/150';
        preview.style.transform = `scale(${r.zoom || 1})`;
    }
    
    const prepArr = r.prep;
    const prepTexto = Array.isArray(prepArr) ? prepArr.join('\n') : prepArr;
    setVal('ed-prep', prepTexto || '');

    abrirEditor();
}

function ajustarZoom(valor) {
    const img = document.getElementById('ed-preview');
    if (img) img.style.transform = `scale(${valor})`;
}

async function salvarReceitaCompleta() {
    const id = document.getElementById('ed-id').value;
    const nome = document.getElementById('ed-nome').value;
    const copo = document.getElementById('ed-copo').value;
    const cat = document.getElementById('ed-cat').value;
    const guar = document.getElementById('ed-guar').value;
    const prepInput = document.getElementById('ed-prep').value;
    const prep = prepInput ? prepInput.split('\n') : [];
    const fileInput = document.getElementById('ed-foto');
    let imgUrl = document.getElementById('ed-img-url').value;
    const zoom = parseFloat(document.getElementById('ed-zoom').value) || 1;

    if (!nome) return alert("Nome é obrigatório");

    // Upload
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '');
        const { error: uploadError } = await _supabase.storage.from('fotos-drinks').upload(fileName, file);
        if (uploadError) return alert("Erro no upload: " + uploadError.message);
        const { data } = _supabase.storage.from('fotos-drinks').getPublicUrl(fileName);
        imgUrl = data.publicUrl;
    }

    // Recuperar ingredientes originais se for edição
    let ings = [];
    if (id) {
        const original = dadosLocais.find(r => r.id == id);
        if (original) ings = original.ings || [];
    }

    // Objeto Limpo (Sem ID)
    const dadosLimpos = limparObjetoReceita({
        nome, cat, copo, guar, ings, prep, img, zoom
    });

    let error = null;
    
    if (id) {
        // Edição: ID vai na query, não no body (ou no body se for upsert com ID, mas update é mais seguro aqui)
        // O usuário pediu upsert. Se for upsert com ID, o ID deve estar no objeto.
        // Mas a regra "Omissão Total de ID em insert" se aplica a novos.
        // Vamos usar upsert. Se tem ID, adicionamos explicitamente.
        const dadosComId = { ...dadosLimpos, id: id };
        const res = await _supabase.from('receitas').upsert(dadosComId);
        error = res.error;
    } else {
        // Novo: Envia SEM ID
        const res = await _supabase.from('receitas').upsert(dadosLimpos);
        error = res.error;
    }

    if (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar: " + error.message);
    } else {
        alert("Salvo com sucesso!");
        fecharEditor();
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

function mudarAba(aba) {
    document.getElementById('catalogo').style.display = 'none';
    document.getElementById('admin-container').style.display = 'none';
    document.getElementById('editor-container').style.display = 'none';
    
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';

    if (aba === 'receitas') {
        document.getElementById('catalogo').style.display = 'block';
        carregarDados();
    } else if (aba === 'admin') {
        document.getElementById('admin-container').style.display = 'block';
    }
}

function abrirEditor() {
    document.getElementById('editor-container').style.display = 'block';
    
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.onclick = fecharEditor;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
    
    // Reset form
    document.getElementById('ed-id').value = "";
    document.getElementById('ed-nome').value = "";
    document.getElementById('ed-copo').value = "";
    document.getElementById('ed-cat').value = "";
    document.getElementById('ed-guar').value = "";
    document.getElementById('ed-prep').value = "";
    document.getElementById('ed-img-url').value = "";
    document.getElementById('ed-zoom').value = "1";
    const preview = document.getElementById('ed-preview');
    if(preview) preview.src = "https://placehold.co/300";
}

function fecharEditor() {
    document.getElementById('editor-container').style.display = 'none';
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
}

function salvarInsumo() { alert("Funcionalidade de Insumos em desenvolvimento."); }
function salvarCategoria() { alert("Funcionalidade de Categorias em desenvolvimento."); }

// Exportações Globais
window.importarDados = importarDados;
window.carregarDados = carregarDados;
window.salvarReceitaCompleta = salvarReceitaCompleta;
window.mudarAba = mudarAba;
window.editarReceita = editarReceita;
window.imprimirFicha = imprimirFicha;
window.excluirReceita = excluirReceita;
window.filtrar = filtrar;
window.ajustarZoom = ajustarZoom;
window.abrirEditor = abrirEditor;
window.fecharEditor = fecharEditor;
window.salvarInsumo = salvarInsumo;
window.salvarCategoria = salvarCategoria;