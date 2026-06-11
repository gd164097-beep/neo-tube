// Chave API
let API_KEY = localStorage.getItem('neotube_api_key') || "AIzaSyAu7HkR91ZNMG7F5-Ar-XUVt_KrtF_bjvk";
let CANAL_ID = '';
let CANAL_DADOS = {};

// Elementos DOM
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const closeMenu = document.getElementById('closeMenu');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const playerModal = document.getElementById('playerModal');
const playerContainer = document.getElementById('playerContainer');
const loadingScreen = document.getElementById('loadingScreen');
const toastContainer = document.getElementById('toastContainer');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('neotube_api_key')) {
        localStorage.setItem('neotube_api_key', API_KEY);
    }
    
    document.getElementById('configApiInput').value = API_KEY;
    
    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pagina = e.target.getAttribute('href').substring(1);
            trocarPagina(pagina);
            sidebar.classList.remove('open');
        });
    });

    // Eventos
    menuBtn.addEventListener('click', () => sidebar.classList.add('open'));
    closeMenu.addEventListener('click', () => sidebar.classList.remove('open'));
    searchBtn.addEventListener('click', pesquisarCanal);
    document.getElementById('updateApiBtn').addEventListener('click', salvarChaveAPI);
    document.getElementById('removeApiBtn').addEventListener('click', removerChaveAPI);
    document.getElementById('clearFavoritesBtn').addEventListener('click', limparFavoritos);
    document.getElementById('clearHistoryBtn').addEventListener('click', limparHistorico);
    document.getElementById('clearAllBtn').addEventListener('click', limparTodosDados);
    document.getElementById('themeToggle').addEventListener('change', alternarTema);
    document.querySelector('.close-btn').addEventListener('click', fecharPlayer);

    if (localStorage.getItem('neotube_tema') === 'claro') {
        document.body.classList.add('light-theme');
        document.getElementById('themeToggle').checked = true;
    }
});

// Funções de Navegação
function trocarPagina(nomePagina) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const paginaAlvo = document.getElementById(nomePagina);
    if (paginaAlvo) paginaAlvo.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === `#${nomePagina}`) {
            item.classList.add('active');
        }
    });
}

// Funções da API
function salvarChaveAPI() {
    const chave = document.getElementById('configApiInput').value.trim();
    if (!chave) {
        mostrarToast('Digite uma chave válida!', 'erro');
        return;
    }
    
    API_KEY = chave;
    localStorage.setItem('neotube_api_key', chave);
    mostrarToast('Chave da API salva com sucesso!', 'sucesso');
}

function removerChaveAPI() {
    if (confirm('Tem certeza que deseja remover a chave da API?')) {
        API_KEY = '';
        localStorage.removeItem('neotube_api_key');
        document.getElementById('configApiInput').value = '';
        mostrarToast('Chave da API removida!', 'aviso');
    }
}

function extrairIdCanal(entrada) {
    entrada = entrada.trim();
    
    if (entrada.startsWith('UC') && entrada.length >= 20) return entrada;
    
    const padroes = [
        /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/@([a-zA-Z0-9_-]+)/,
        /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/user\/([a-zA-Z0-9_-]+)/
    ];

    for (const regex of padroes) {
        const match = entrada.match(regex);
        if (match) return match[1];
    }

    if (entrada.startsWith('@')) return entrada.substring(1);
    
    return entrada;
}

async function pesquisarCanal() {
    if (!API_KEY) {
        mostrarToast('Chave da API não encontrada!', 'erro');
        trocarPagina('configuracoes');
        return;
    }

    const entrada = searchInput.value.trim();
    if (!entrada) {
        mostrarToast('Digite um canal para pesquisar!', 'aviso');
        return;
    }

    mostrarCarregamento(true);
    try {
        const identificador = extrairIdCanal(entrada);
        let canalId = identificador;

        if (!identificador.startsWith('UC')) {
            const buscaResp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(identificador)}&type=channel&key=${API_KEY}`);
            
            if (!buscaResp.ok) throw new Error(`Erro na requisição: ${buscaResp.status}`);
            
            const buscaData = await buscaResp.json();
            
            if (buscaData.error) throw new Error(`Erro da API: ${buscaData.error.message}`);
            if (!buscaData.items || buscaData.items.length === 0) throw new Error('Canal não encontrado! Verifique o nome ou ID.');
            
            canalId = buscaData.items[0].id.channelId;
        }

        const canalResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,contentDetails&id=${canalId}&key=${API_KEY}`);
        
        if (!canalResp.ok) throw new Error(`Erro na requisição: ${canalResp.status}`);
        
        const canalData = await canalResp.json();
        
        if (canalData.error) throw new Error(`Erro da API: ${canalData.error.message}`);
        if (!canalData.items || canalData.items.length === 0) throw new Error('Dados do canal não encontrados!');
        
        CANAL_DADOS = canalData.items[0];
        CANAL_ID = canalId;
        
        salvarHistorico(canalId, CANAL_DADOS.snippet.title);
        
        exibirDadosCanal();
        await carregarVideosCorrigido();
        await carregarPlaylists();
        
        trocarPagina('canal');
        mostrarToast('Canal carregado com sucesso!', 'sucesso');
        
    } catch (erro) {
        console.error('Detalhe do erro:', erro);
        mostrarToast(`Erro: ${erro.message}`, 'erro');
    } finally {
        mostrarCarregamento(false);
    }
}

function exibirDadosCanal() {
    const { snippet, statistics, brandingSettings } = CANAL_DADOS;
    
    document.getElementById('canalBanner').style.backgroundImage = 
        `url(${brandingSettings.image?.bannerExternalUrl || 'https://via.placeholder.com/1200x200?text=Sem+Banner'})`;
    
    document.getElementById('canalInfo').innerHTML = `
        <img src="${snippet.thumbnails.high.url || 'https://via.placeholder.com/120'}" alt="Avatar" class="canal-avatar">
        <div class="canal-dados">
            <h2>${snippet.title}</h2>
            <p class="canal-descricao">${snippet.description || 'Sem descrição'}</p>
            <div class="canal-estatisticas">
                <div class="estat-item">
                    <h4>Inscritos</h4>
                    <p>${formatarNumero(statistics.subscriberCount)}</p>
                </div>
                <div class="estat-item">
                    <h4>Vídeos</h4>
                    <p>${formatarNumero(statistics.videoCount)}</p>
                </div>
                <div class="estat-item">
                    <h4>Visualizações</h4>
                    <p>${formatarNumero(statistics.viewCount)}</p>
                </div>
                <div class="estat-item">
                    <h4>Criado em</h4>
                    <p>${formatarData(snippet.publishedAt)}</p>
                </div>
                ${snippet.country ? `
                <div class="estat-item">
                    <h4>País</h4>
                    <p>${snippet.country}</p>
                </div>` : ''}
            </div>
            <div class="botoes-acao">
                <button class="neon-btn" onclick="copiarIdCanal('${CANAL_ID}')">
                    <i class="fa fa-copy"></i> Copiar ID
                </button>
                <button class="neon-btn" onclick="compartilharCanal('${snippet.title}', '${CANAL_ID}')">
                    <i class="fa fa-share"></i> Compartilhar
                </button>
                <button class="neon-btn" onclick="adicionarFavorito('canal', '${CANAL_ID}', '${snippet.title}', '${snippet.thumbnails.high.url}')">
                    <i class="fa fa-star"></i> Favoritar
                </button>
            </div>
        </div>
    `;
}

async function carregarVideosCorrigido() {
    try {
        const uploadsId = CANAL_DADOS.contentDetails.relatedPlaylists.uploads;
        
        const resp = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=50&key=${API_KEY}`);
        
        if (!resp.ok) throw new Error(`Erro ao carregar vídeos: ${resp.status}`);
        
        const data = await resp.json();
        
        if (data.error) throw new Error(`Erro: ${data.error.message}`);
        if (!data.items || data.items.length === 0) {
            document.getElementById('videosGrid').innerHTML = '<p class="aviso">Nenhum vídeo público encontrado</p>';
            return;
        }
        
        const videosGrid = document.getElementById('videosGrid');
        videosGrid.innerHTML = '';
        
        for (const item of data.items) {
            const videoId = item.contentDetails.videoId;
            const videoResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoId}&key=${API_KEY}`);
            
            if (!videoResp.ok) continue;
            
            const videoData = await videoResp.json();
            
            if (!videoData.items || videoData.items.length === 0) continue;
            
            const detalhes = videoData.items[0];
            const duracao = formatarDuracao(detalhes.contentDetails.duration);
            
            const card = document.createElement('div');
            card.className = 'video-card';
            card.onclick = () => abrirPlayer(videoId, item.snippet.title);
            
            card.innerHTML = `
                <div style="position: relative;">
                    <img src="${item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url || 'https://via.placeholder.com/300x180'}" alt="Thumbnail" class="video-thumbnail">
                    <span class="video-duracao">${duracao}</span>
                </div>
                <div class="video-info">
                    <h3 class="video-titulo">${item.snippet.title}</h3>
                    <p class="video-meta">${formatarNumero(detalhes.statistics.viewCount)} visualizações • ${formatarData(item.snippet.publishedAt)}</p>
                </div>
            `;
            
            videosGrid.appendChild(card);
        }
        
    } catch (erro) {
        document.getElementById('videosGrid').innerHTML = `<p class="erro">Erro ao carregar vídeos: ${erro.message}</p>`;
    }
}

async function carregarPlaylists() {
    try {
        const resp = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${CANAL_ID}&maxResults=20&key=${API_KEY}`);
        
        if (!resp.ok) throw new Error(`Erro ao carregar playlists: ${resp.status}`);
        
        const data = await resp.json();
        
        if (data.error) throw new Error(`Erro: ${data.error.message}`);
        if (!data.items || data.items.length === 0) {
            document.getElementById('playlistsGrid').innerHTML = '<p>Nenhuma playlist pública encontrada</p>';
            return;
        }
        
        const playlistsGrid = document.getElementById('playlistsGrid');
        playlistsGrid.innerHTML = '';
        
        data.items.forEach(playlist => {
            const card = document.createElement('div');
            card.className = 'video-card';
            
            card.innerHTML = `
                <img src="${playlist.snippet.thumbnails.high?.url || 'https://via.placeholder.com/300x180'}" alt="Playlist" class="video-thumbnail">
                <div class="video-info">
                    <h3 class="video-titulo">${playlist.snippet.title}</h3>
                    <p class="video-meta">${playlist.contentDetails.itemCount} vídeos</p>
                </div>
            `;
            
            playlistsGrid.appendChild(card);
        });
        
    } catch (erro) {
        document.getElementById('playlistsGrid').innerHTML = `<p class="erro">Erro ao carregar playlists: ${erro.message}</p>`;
    }
}

function abrirPlayer(videoId, titulo) {
    playerContainer.innerHTML = `
        <iframe 
            src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
            title="${titulo}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
        </iframe>
    `;
    playerModal.style.display = 'block';
    salvarHistoricoVideo(videoId, titulo);
}

function fecharPlayer() {
    playerModal.style.display = 'none';
    playerContainer.innerHTML = '';
}

// Funções Auxiliares
function formatarNumero(numero) {
    if (!numero) return '0';
    return new Intl.NumberFormat('pt-BR').format(numero);
}

function formatarData(dataISO) {
    return new Date(dataISO).toLocaleDateString('pt-BR');
}

function formatarDuracao(duracaoISO) {
    const match = duracaoISO.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '00:00';
    
    const horas = match[1] ? match[1].padStart(2, '0') : null;
    const minutos = match[2] ? match[2].padStart(2, '0') : '00';
    const segundos = match[3] ? match[3].padStart(2, '0') : '00';
    
    return horas ? `${horas}:${minutos}:${segundos}` : `${minutos}:${segundos}`;
}

function mostrarCarregamento(mostrar) {
    loadingScreen.style.display = mostrar ? 'flex' : 'none';
}

function mostrarToast(mensagem, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensagem;
    
    if (tipo === 'sucesso') toast.style.borderLeftColor = '#22c55e';
    if (tipo === 'erro') toast.style.borderLeftColor = '#ef4444';
    if (tipo === 'aviso') toast.style.borderLeftColor = '#f59e0b';
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Funções de Armazenamento
function salvarHistorico(canalId, nomeCanal) {
    const historico = JSON.parse(localStorage.getItem('neotube_historico_canais') || '[]');
    const existe = historico.find(h => h.id === canalId);
    
    if (!existe) {
        historico.unshift({ id: canalId, nome: nomeCanal, data: new Date().toISOString() });
        if (historico.length > 20) historico.pop();
        localStorage.setItem('neotube_historico_canais', JSON.stringify(historico));
    }
}

function salvarHistoricoVideo(videoId, titulo) {
    const historico = JSON.parse(localStorage.getItem('neotube_historico_videos') || '[]');
    historico.unshift({ id: videoId, titulo: titulo, data: new Date().toISOString() });
    if (historico.length > 50) historico.pop();
    localStorage.setItem('neotube_historico_videos', JSON.stringify(historico));
}

function adicionarFavorito(tipo, id, nome, imagem) {
    const favoritos = JSON.parse(localStorage.getItem('neotube_favoritos') || '[]');
    const existe = favoritos.find(f => f.id === id);
    
    if (existe) {
        mostrarToast('Item já está nos favoritos!', 'aviso');
        return;
    }
    
    favoritos.push({ tipo, id, nome, imagem, data: new Date().toISOString() });
    localStorage.setItem('neotube_favoritos', JSON.stringify(favoritos));
    mostrarToast('Adicionado aos favoritos!', 'sucesso');
}

function limparFavoritos() {
    if (confirm('Tem certeza que deseja limpar todos os favoritos?')) {
        localStorage.removeItem('neotube_favoritos');
        mostrarToast('Favoritos limpos!', 'sucesso');
    }
}

function limparHistorico() {
    if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
        localStorage.removeItem('neotube_historico_canais');
        localStorage.removeItem('neotube_historico_videos');
        mostrarToast('Histórico limpo!', 'sucesso');
    }
}

function limparTodosDados() {
    if (confirm('Tem certeza que deseja apagar TODOS os dados salvos?')) {
        localStorage.clear();
        API_KEY = "AIzaSyAu7HkR91ZNMG7F5-Ar-XUVt_KrtF_bjvk";
        localStorage.setItem('neotube_api_key', API_KEY);
        document.getElementById('configApiInput').value = API_KEY;
        mostrarToast('Todos os dados foram removidos!', 'sucesso');
        setTimeout(() => window.location.reload(), 1000);
    }
}

function alternarTema() {
    document.body.classList.toggle('light-theme');
    localStorage.setItem('neotube_tema', document.body.classList.contains('light-theme') ? 'claro' : 'escuro');
}

// Funções Complementares
function copiarIdCanal(id) {
    navigator.clipboard.writeText(id);
    mostrarToast('ID copiado para a área de transferência!', 'sucesso');
}

function compartilharCanal(nome, id) {
    const url = `https://youtube.com/channel/${id}`;
    if (navigator.share) {
        navigator.share({ title: nome, url: url });
    } else {
        navigator.clipboard.writeText(url);
        mostrarToast('Link copiado!', 'sucesso');
    }
}
