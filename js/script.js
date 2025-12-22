const VERSION = "31.0";
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

window.onload = () => {
    console.log(`Bar Manager Pro v${VERSION} carregado.`);
    carregarDados();
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();

    // 1. Visualização da Foto no Modal
    const fileInput = document.getElementById('ed-foto');
    if (fileInput) {
        fileInput.onchange = function(evt) {
            const file = evt.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('ed-preview');
                    if (preview) {
                        preview.src = e.target.result;
                        // 3. Estilo do Preview
                        preview.style.maxWidth = "100%";
                        if (preview.parentElement) preview.parentElement.style.overflow = "hidden";
                    }
                };
                reader.readAsDataURL(file);
            }
        };
    }
};

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

function atualizarRelogio() {
    const el = document.getElementById('system-info');
    if (el) {
        const dataHora = new Date().toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo'
        });
        el.innerHTML = `Versão ${VERSION}<br>${dataHora}`;
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
                    ${(Array.isArray(r.ings) ? r.ings : (r.ings || '').split(',')).map(i => i.trim() ? `<li>${i.trim()}</li>` : '').join('')}
                </ul>

                <h3>MODO DE PREPARO</h3>
                <ul>
                    ${(Array.isArray(r.prep) ? r.prep : (r.prep || '').split(/[\n.]/)).map(p => p.trim() ? `<li>${p.trim()}</li>` : '').join('')}
                </ul>

                <div class="card-actions no-print">
                    <button class="btn-card btn-primary btn-visualizar" onclick="visualizarFicha('${r.id}')">👁️ Visualizar</button>
                    <button class="btn-card btn-primary" onclick="editarReceita('${r.id}')">✏️ Editar</button>
                    <button class="btn-card btn-primary" onclick="imprimirFicha('${r.id}')">🖨️ Imprimir</button>
                    <button class="btn-card btn-secondary" onclick="excluirReceita('${r.id}')">🗑️ Excluir</button>
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

            // 1. RECEITAS (Aceita array direto ou chave 'receitas')
            const listaReceitas = Array.isArray(json) ? json : (json.receitas || []);
            if (listaReceitas.length > 0) {
                // Mapeia e limpa cada item
                const receitasFormatadas = listaReceitas.map(r => {
                    const itemLimpo = limparObjetoReceita(r);
                    // Regra 2: Remoção Total do ID na importação
                    if (itemLimpo.id) delete itemLimpo.id;
                    return itemLimpo;
                });

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
    const r = dadosLocais.find(item => String(item.id) === String(id));
    if (!r) return;

    const janela = window.open('', '_blank', 'width=900,height=800');
    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>Imprimir - ${r.nome}</title>
            <link rel="stylesheet" href="../css/style.css">
            <style>
                body { background: white; display: block; margin: 0; }
                #catalogo { margin: 0; padding: 0; box-shadow: none; width: 100%; }
                .drink-card { border: none !important; box-shadow: none !important; margin: 0; padding: 0; width: 100%; }
                .no-print { display: none !important; }
            </style>
        </head>
        <body>
            <div id="catalogo">
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
                        <ul>
                            ${Array.isArray(r.prep) ? r.prep.map(p => `<li>${p}</li>`).join('') : `<li>${r.prep || '-'}</li>`}
                        </ul>
                    </div>
                    
                    <div class="foto-container">
                        <img src="${r.img || ''}" style="transform: scale(${r.zoom || 1}); transform-origin: center;" onerror="this.src='https://placehold.co/300'">
                    </div>
                </div>
            </div>
            <script>
                window.onload = function() { 
                    setTimeout(() => { 
                        window.print(); 
                        window.close(); 
                    }, 500); 
                }
            <\/script>
        </body>
        </html>
    `);
    janela.document.close();
}

function editarReceita(id) {
    // 1. Busca de Dados
    const r = dadosLocais.find(item => String(item.id) === String(id));
    if (!r) return;

    // 2. Preenchimento de Campos
    document.getElementById('ed-id').value = r.id;
    
    const nomeInput = document.getElementById('ed-nome');
    nomeInput.value = r.nome || '';
    nomeInput.classList.remove('input-error');

    document.getElementById('ed-cat').value = r.cat || '';
    document.getElementById('ed-copo').value = r.copo || '';
    document.getElementById('ed-guar').value = r.guar || '';
    document.getElementById('ed-img-url').value = r.img || '';
    document.getElementById('ed-zoom').value = r.zoom || 1;

    // 3. Tratamento de Texto
    document.getElementById('ed-prep').value = Array.isArray(r.prep) ? r.prep.join('\n') : (r.prep || '');

    // 4. Preview da Imagem
    const preview = document.getElementById('ed-preview');
    if (preview) {
        preview.src = r.img || 'https://placehold.co/300';
        preview.style.transform = `scale(${r.zoom || 1})`;
    }

    // 5. Exibição (Sem resetar o formulário)
    document.getElementById('editor-container').style.display = 'block';
    
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.onclick = fecharEditor;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
}

function ajustarZoom(valor) {
    const img = document.getElementById('ed-preview');
    if (img) img.style.transform = `scale(${valor})`;
}

async function salvarReceitaCompleta() {
    // 4. Feedback
    console.log("💾 Iniciando salvamento da receita...");

    const id = document.getElementById('ed-id').value;
    const nomeInput = document.getElementById('ed-nome');
    const nome = nomeInput.value.trim();
    const copo = document.getElementById('ed-copo').value;
    const cat = document.getElementById('ed-cat').value;
    const guar = document.getElementById('ed-guar').value;
    const prepInput = document.getElementById('ed-prep').value;
    const prep = prepInput ? prepInput.split('\n').map(p => p.trim()).filter(p => p !== '') : [];
    const fileInput = document.getElementById('ed-foto');
    let imgUrl = document.getElementById('ed-img-url').value;
    const zoom = parseFloat(document.getElementById('ed-zoom').value) || 1;
    
    // Validação Visual
    nomeInput.classList.remove('input-error');
    
    if (!nome) {
        nomeInput.classList.add('input-error');
        return alert("O campo Nome é obrigatório.");
    }

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

    // Sanitização e Limpeza
    const dadosLimpos = limparObjetoReceita({
        nome, cat, copo, guar, ings, prep, img: imgUrl, zoom
    });

    let error = null;
    
    if (id) {
        // Edição: Mantém ID para atualizar a receita correta
        dadosLimpos.id = id;
        const res = await _supabase.from('receitas').upsert(dadosLimpos);
        error = res.error;
    } else {
        // Novo: Remove ID para evitar erro de null value
        delete dadosLimpos.id;
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

function toggleSidebar() {
    const nav = document.querySelector('nav');
    const overlay = document.getElementById('sidebar-overlay');
    nav.classList.toggle('sidebar-active');
    
    if (nav.classList.contains('sidebar-active')) {
        overlay.style.display = 'block';
    } else {
        overlay.style.display = 'none';
    }
}

function visualizarFicha(id) {
    const r = dadosLocais.find(item => String(item.id) === String(id));
    if (!r) return;

    const modal = document.getElementById('fullscreen-modal');
    modal.innerHTML = `
        <div style="max-width: 600px; margin: 0 auto; padding-bottom: 50px;">
            <button onclick="fecharFullscreen()" style="position: fixed; top: 20px; right: 20px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 50px; height: 50px; font-size: 24px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 2001;">✕</button>
            
            <h1 style="color: #2489FF; font-size: 28px; margin-top: 40px; text-transform: uppercase; text-align: center;">${r.nome}</h1>
            
            <div style="width: 100%; height: 300px; border-radius: 16px; overflow: hidden; margin: 20px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <img src="${r.img || 'https://placehold.co/300'}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            
            <p style="text-align: center; font-size: 1.1rem; color: #666;"><strong>${r.cat || '-'}</strong> | ${r.copo || '-'}</p>

            <h3 style="font-size: 22px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px; color: #333;">INGREDIENTES</h3>
            <ul style="font-size: 1.2rem; list-style-type: disc; padding-left: 25px; line-height: 1.6; color: #444;">
                ${(Array.isArray(r.ings) ? r.ings : (r.ings || '').split(',')).map(i => i.trim() ? `<li>${i.trim()}</li>` : '').join('')}
            </ul>

            <h3 style="font-size: 22px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px; color: #333;">MODO DE PREPARO</h3>
            <ul style="font-size: 1.2rem; list-style-type: disc; padding-left: 25px; line-height: 1.6; color: #444;">
                ${(Array.isArray(r.prep) ? r.prep : (r.prep || '').split(/[\n.]/)).map(p => p.trim() ? `<li>${p.trim()}</li>` : '').join('')}
            </ul>
        </div>
    `;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function fecharFullscreen() {
    document.getElementById('fullscreen-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
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
    const nomeInput = document.getElementById('ed-nome');
    nomeInput.value = "";
    nomeInput.classList.remove('input-error'); // Remove erro visual anterior
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
window.toggleSidebar = toggleSidebar;
window.visualizarFicha = visualizarFicha;
window.fecharFullscreen = fecharFullscreen;