document.addEventListener("DOMContentLoaded", () => {
    // === Elements ===
    const podcastList = document.getElementById("podcastList");
    const playerOverlay = document.getElementById('playerOverlay');
    const closeOverlayBtn = document.getElementById('closeOverlayBtn');
    const loadingScreen = document.getElementById('loadingScreen');
    const podcastHeader = document.getElementById('podcastHeader');
    const episodeListContainer = document.getElementById('episodeListContainer');
    const stickyPlayer = document.getElementById('stickyPlayer');
    const mainAudio = document.getElementById('mainAudio');
    const headerBg = document.getElementById('headerBg');
    const navTitle = document.getElementById('navTitle');
    const episodeCount = document.getElementById('episodeCount');

    // Sticky Player Elements
    const playerCover = document.getElementById('playerCover');
    const playerTitle = document.getElementById('playerTitle');
    const playerShow = document.getElementById('playerShow');
    const stickyPlayBtn = document.getElementById('stickyPlayBtn');
    const skipBackBtn = document.getElementById('skipBackBtn');
    const skipFwdBtn = document.getElementById('skipFwdBtn');
    const seekBar = document.getElementById('seekBar');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');

    // === State ===
    let currentFeed = null;
    let isPlaying = false;
    let currentEpisode = null;

    // === Podcast Data ===
    const podcasts = [
        {
            title: "เล่าเรื่องเก่ง",
            creator: "sorasukt",
            image: "/img/podcast/TMSA.png",
            rating: "4.8",
            listeners: "54K",
            rss: "https://s3.ap-southeast-1.amazonaws.com/rss.stnetradio.com/STNETRadioEnt/TMSA/RSS.xml",
            appleEmbed: "https://embed.podcasts.apple.com/th/podcast/id1486563415"
        },
        {
            title: "Talking with LITALK",
            creator: "LITALK Education",
            image: "/img/podcast/LITALK.png",
            rating: "ใหม่",
            listeners: "1K",
            rss: "https://s3.ap-southeast-1.amazonaws.com/rss.stnetradio.com/SoaqerStudio/LITALKPodcast/RSS.xml",
            appleEmbed: "https://embed.podcasts.apple.com/th/podcast/talking-with-litalk/id1786381161"
        },
        {
            title: "ติดกับเรื่องราว",
            creator: "sorasukt",
            image: "/img/podcast/TIDKAB.png",
            rating: "3.2",
            listeners: "317",
            rss: "https://anchor.fm/s/5b844008/podcast/rss",
            appleEmbed: "https://embed.podcasts.apple.com/th/podcast/id1564119401"
        },
    ];

    // === Helpers ===
    function isThaiText(text) {
        return /[\u0E00-\u0E7F]/.test(text);
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // === Render Podcast Cards ===
    function renderPodcasts() {
        podcastList.innerHTML = podcasts.map((podcast) => {
            const fontClass = isThaiText(podcast.title) ? 'thai-font' : 'english-font';
            const ratingHtml = podcast.rating === 'ใหม่'
                ? `<span class="stat-badge"><i class="fa-solid fa-star-half-stroke"></i> รายการใหม่</span>`
                : `<span class="stat-badge"><i class="fa-solid fa-star"></i> ${podcast.rating}</span>`;

            return `
            <div class="podcast-card" onclick="openPodcast('${podcast.rss}','${podcast.appleEmbed}',event)" tabindex="0" role="button" aria-label="เปิด ${podcast.title}">
                <div class="podcast-image">
                    <img src="${podcast.image}" alt="${podcast.title}" loading="lazy">
                    <div class="podcast-play-overlay">
                        <i class="fa-solid fa-circle-play"></i>
                    </div>
                </div>
                <div class="podcast-content">
                    <div class="podcast-title ${fontClass}">${podcast.title}</div>
                    <div class="podcast-creator ${isThaiText(podcast.creator) ? 'thai-font-p' : 'english-font-p'}">โดย ${podcast.creator}</div>
                    <div class="podcast-stats">
                        ${ratingHtml}
                        <span>${podcast.listeners} ผู้ฟัง</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        observeCards();
    }

    // === Scroll-triggered card animation ===
    function observeCards() {
        const cards = document.querySelectorAll('.podcast-card');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, i * 80);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        cards.forEach(card => observer.observe(card));
    }

    let currentAppleEmbed = null;

    // === Open Podcast (available to ALL users) ===
    window.openPodcast = (rssUrl, appleEmbed, event) => {
        if (event) event.preventDefault();
        currentAppleEmbed = appleEmbed || null;

        history.pushState({ view: 'player', rss: rssUrl }, '', '#player');
        playerOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';

        if (currentFeed !== rssUrl) {
            loadFeed(rssUrl);
            currentFeed = rssUrl;
        }
    };

    function closeOverlay() {
        playerOverlay.classList.remove('visible');
        document.body.style.overflow = '';
    }

    window.addEventListener('popstate', () => {
        if (playerOverlay.classList.contains('visible')) closeOverlay();
    });

    closeOverlayBtn.addEventListener('click', () => history.back());

    // === Load RSS Feed (with fallback proxies) ===
    const CORS_PROXIES = [
        url => 'https://corsproxy.io/?' + encodeURIComponent(url),
        url => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
        url => 'https://thingproxy.freeboard.io/fetch/' + url,
    ];

    // Fetches RSS and parses XML — retries next proxy if response is bad/HTML
    function fetchRSS(feedUrl, proxyIndex = 0) {
        if (proxyIndex >= CORS_PROXIES.length) {
            return Promise.reject(new Error('โหลดไม่สำเร็จ กรุณาลองใหม่ภายหลัง'));
        }
        const proxiedUrl = CORS_PROXIES[proxyIndex](feedUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        return fetch(proxiedUrl, { signal: controller.signal })
            .then(r => { clearTimeout(timeoutId); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
            .then(str => {
                const doc = new window.DOMParser().parseFromString(str, "text/xml");
                // If proxy returned HTML/error page, DOMParser gives a parsererror doc
                if (doc.querySelector('parsererror') || !doc.getElementsByTagName('channel')[0]) {
                    throw new Error('Not valid RSS');
                }
                return doc;
            })
            .catch(err => {
                clearTimeout(timeoutId);
                console.warn(`Proxy ${proxyIndex} failed (${err.message}), trying next...`);
                return fetchRSS(feedUrl, proxyIndex + 1);
            });
    }

    function loadFeed(feedUrl) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
        podcastHeader.innerHTML = '';
        episodeListContainer.innerHTML = '';

        fetchRSS(feedUrl)
            .then(data => {
                const channel = data.getElementsByTagName("channel")[0];
                if (!channel) throw new Error("Invalid RSS feed");

                const podcastTitle = getTagValue(channel, "title");
                const podcastDesc = getTagValue(channel, "description").replace(/<[^>]*>?/gm, '');

                // Image: try <image><url>, then itunes:image
                let podcastImage = '/img/STNET-App.png';
                const imageTag = channel.getElementsByTagName("image")[0];
                const imageUrl = imageTag ? imageTag.getElementsByTagName("url")[0] : null;
                if (imageUrl && imageUrl.textContent.trim()) {
                    podcastImage = imageUrl.textContent.trim();
                } else {
                    const itunesImage = channel.getElementsByTagNameNS("http://www.itunes.com/dtds/podcast-1.0.dtd", "image")[0];
                    if (itunesImage) podcastImage = itunesImage.getAttribute("href");
                }

                headerBg.style.backgroundImage = `url('${podcastImage}')`;
                navTitle.textContent = podcastTitle;
                navTitle.style.opacity = '1';

                podcastHeader.innerHTML = `
                    <img src="${podcastImage}" alt="${podcastTitle}" class="podcast-cover">
                    <div class="podcast-title">${podcastTitle}</div>
                    <div class="podcast-desc">${podcastDesc}</div>
                `;

                const items = Array.from(data.getElementsByTagName("item"));
                episodeCount.textContent = `${items.length} ตอน`;

                if (items.length === 0) {
                    episodeListContainer.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--secondary-text);">ไม่พบตอน</div>';
                } else {
                    episodeListContainer.innerHTML = '';
                    items.forEach((item) => {
                        const title = getTagValue(item, "title");
                        const pubDate = new Date(getTagValue(item, "pubDate")).toLocaleDateString('th-TH', {
                            year: 'numeric', month: 'short', day: 'numeric'
                        });
                        const rawDesc = getTagValue(item, "description").replace(/<[^>]*>?/gm, '');
                        const desc = rawDesc.substring(0, 150) + (rawDesc.length > 150 ? '...' : '');

                        const enclosure = item.getElementsByTagName("enclosure")[0];
                        const audioUrl = enclosure ? enclosure.getAttribute("url") : null;

                        let epImage = podcastImage;
                        const epItunesImage = item.getElementsByTagNameNS("http://www.itunes.com/dtds/podcast-1.0.dtd", "image")[0];
                        if (epItunesImage) epImage = epItunesImage.getAttribute("href");

                        if (!audioUrl) return;

                        const card = document.createElement('div');
                        card.className = 'episode-item';
                        if (currentEpisode && currentEpisode.url === audioUrl) card.classList.add('active');

                        const isActive = currentEpisode && currentEpisode.url === audioUrl;
                        card.innerHTML = `
                            <div class="ep-date">${pubDate}</div>
                            <div class="ep-title">${title}</div>
                            <div class="ep-desc">${desc}</div>
                            <div class="ep-meta">
                                <div class="play-btn-small">
                                    ${isActive && isPlaying
                                ? '<i class="fa-solid fa-pause"></i> กำลังเล่น'
                                : '<i class="fa-solid fa-play"></i> เล่น'}
                                </div>
                            </div>`;

                        card.addEventListener('click', () => {
                            playEpisode(title, audioUrl, epImage, card, podcastTitle);
                        });

                        episodeListContainer.appendChild(card);
                    });
                }

                loadingScreen.style.opacity = '0';
                setTimeout(() => { loadingScreen.style.display = 'none'; }, 300);
            })
            .catch(err => {
                console.error(err);
                if (currentAppleEmbed) {
                    // Show Apple Podcasts embed player inside the overlay
                    loadingScreen.style.display = 'none';
                    episodeListContainer.innerHTML = `
                        <div style="padding:1.5rem 0;">
                            <iframe
                                allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
                                frameborder="0"
                                height="450"
                                style="width:100%;border-radius:12px;overflow:hidden;"
                                sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
                                src="${currentAppleEmbed}?theme=auto"
                            ></iframe>
                        </div>`;
                    episodeCount.textContent = '';
                } else {
                    loadingScreen.innerHTML = `
                        <div style="text-align:center;padding:2rem;">
                            <i class="fa-solid fa-circle-exclamation" style="font-size:2rem;color:var(--accent-color);margin-bottom:1rem;display:block;"></i>
                            เกิดข้อผิดพลาดในการโหลด<br><small style="opacity:0.7;">${err.message}</small>
                        </div>`;
                }
            });
    }

    function getTagValue(parent, tagName) {
        const tag = parent.querySelector(tagName);
        return tag ? tag.textContent.trim() : '';
    }

    // === Play Episode ===
    function playEpisode(title, url, image, cardElement, podcastTitle) {
        currentEpisode = { title, url, image, podcastTitle };
        isPlaying = true;

        playerTitle.textContent = title;
        playerShow.textContent = podcastTitle;
        if (playerCover) { playerCover.src = image; playerCover.alt = title; }

        mainAudio.src = url;
        mainAudio.play().catch(e => console.warn("Autoplay blocked:", e));

        updatePlayIcons(true);
        stickyPlayer.classList.add('visible');

        document.querySelectorAll('.episode-item').forEach(el => {
            el.classList.remove('active');
            const btn = el.querySelector('.play-btn-small');
            if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> เล่น';
        });

        if (cardElement) {
            cardElement.classList.add('active');
            const btn = cardElement.querySelector('.play-btn-small');
            if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i> กำลังเล่น';
        }

        // Media Session API
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title,
                artist: podcastTitle,
                album: podcastTitle,
                artwork: [
                    { src: image, sizes: '512x512', type: 'image/png' },
                    { src: image, sizes: '256x256', type: 'image/png' },
                ]
            });
            navigator.mediaSession.setActionHandler('play', () => { mainAudio.play(); updatePlayIcons(true); });
            navigator.mediaSession.setActionHandler('pause', () => { mainAudio.pause(); updatePlayIcons(false); });
            navigator.mediaSession.setActionHandler('seekbackward', (d) => { mainAudio.currentTime = Math.max(mainAudio.currentTime - (d.seekOffset || 15), 0); });
            navigator.mediaSession.setActionHandler('seekforward', (d) => { mainAudio.currentTime = Math.min(mainAudio.currentTime + (d.seekOffset || 15), mainAudio.duration); });
        }
    }

    // === Play / Pause Toggle ===
    function togglePlay() {
        if (!currentEpisode) return;
        if (mainAudio.paused) mainAudio.play();
        else mainAudio.pause();
    }

    function updatePlayIcons(playing) {
        stickyPlayBtn.innerHTML = `<i class="fa-solid ${playing ? 'fa-pause' : 'fa-play'}"></i>`;
    }

    // === Skip Buttons ===
    skipBackBtn.addEventListener('click', () => {
        mainAudio.currentTime = Math.max(mainAudio.currentTime - 15, 0);
    });

    skipFwdBtn.addEventListener('click', () => {
        mainAudio.currentTime = Math.min(mainAudio.currentTime + 15, mainAudio.duration || 0);
    });

    // === Seek Bar ===
    mainAudio.addEventListener('timeupdate', () => {
        if (!mainAudio.duration) return;
        const progress = (mainAudio.currentTime / mainAudio.duration) * 100;
        seekBar.value = progress;
        seekBar.style.setProperty('--progress', `${progress}%`);
        currentTimeEl.textContent = formatTime(mainAudio.currentTime);
    });

    mainAudio.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(mainAudio.duration);
    });

    seekBar.addEventListener('input', () => {
        if (!mainAudio.duration) return;
        mainAudio.currentTime = (seekBar.value / 100) * mainAudio.duration;
        seekBar.style.setProperty('--progress', `${seekBar.value}%`);
    });

    // === Audio Events ===
    mainAudio.addEventListener('play', () => { isPlaying = true; updatePlayIcons(true); });
    mainAudio.addEventListener('pause', () => { isPlaying = false; updatePlayIcons(false); });
    mainAudio.addEventListener('error', () => {
        console.error("Audio Error:", mainAudio.error);
        isPlaying = false;
        updatePlayIcons(false);
    });

    stickyPlayBtn.addEventListener('click', togglePlay);

    // === Init ===
    renderPodcasts();
});
