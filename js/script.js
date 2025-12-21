const URL_SB = "https://kfdtfzxmdamugokdjkro.supabase.co";
const KEY_SB = "sb_publishable_DTdFzGhL1iW33zuCieeoeA_OvvhjAfn";

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
            <div style="display:flex; justify-content:space-between; border-bottom:2px solid black;">
                <h1>${(r.nome || 'SEM NOME').toUpperCase()}</h1>
                <img src="${r.img || ''}" onerror="this.src='https://placehold.co/100'" style="width:100px; height:100px;">
            </div>
            <p><strong>Copo:</strong> ${r.copo || '-'}</p>
            <p><strong>Preparo:</strong> ${Array.isArray(r.prep) ? r.prep.join(' | ') : 'Formato de preparo inválido'}</p>
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