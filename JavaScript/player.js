document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const feedUrl = urlParams.get('feed');

    const loadingScreen = document.getElementById('loadingScreen');
    const podcastHeader = document.getElementById('podcastHeader');
    const episodeListContainer = document.getElementById('episodeListContainer');
    const stickyPlayer = document.getElementById('stickyPlayer');
    const mainAudio = document.getElementById('mainAudio');
    const playerCover = document.getElementById('playerCover');
    const playerTitle = document.getElementById('playerTitle');
    const headerBg = document.getElementById('headerBg');
    const navTitle = document.getElementById('navTitle');
    const episodeCount = document.getElementById('episodeCount');

    if (!feedUrl) {
        loadingScreen.innerHTML = '<div>No feed URL provided.</div>';
        return;
    }

    // Use corsproxy.io
    const corsProxy = 'https://corsproxy.io/?';
    const proxiedUrl = corsProxy + encodeURIComponent(feedUrl);

    // Timeout logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    fetch(proxiedUrl, { signal: controller.signal })
        .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
        .then(data => {
            const channel = data.querySelector("channel");
            if (!channel) throw new Error("Invalid RSS feed");

            // --- Parse Podcast Info ---
            const podcastTitle = getTagValue(channel, "title");
            const podcastDesc = getTagValue(channel, "description").replace(/<[^>]*>?/gm, ''); // Strip HTML

            // Image fallback logic
            let podcastImage = '/img/STNET-App.png';
            const imageTag = channel.querySelector("image");
            if (imageTag && imageTag.querySelector("url")) {
                podcastImage = imageTag.querySelector("url").textContent.trim();
            } else {
                const itunesImage = channel.getElementsByTagNameNS("http://www.itunes.com/dtds/podcast-1.0.dtd", "image")[0];
                if (itunesImage) podcastImage = itunesImage.getAttribute("href");
            }

            // --- Update UI ---

            // Set Blurred Background
            headerBg.style.backgroundImage = `url('${podcastImage}')`;

            // Set Nav Title (Initially hidden via CSS opacity, but set text)
            navTitle.textContent = podcastTitle;

            // Render Header
            podcastHeader.innerHTML = `
                <img src="${podcastImage}" alt="${podcastTitle}" class="podcast-cover">
                <div class="podcast-title">${podcastTitle}</div>
                <div class="podcast-desc">${podcastDesc}</div>
            `;

            // --- Parse Episodes ---
            const items = Array.from(data.querySelectorAll("item"));
            episodeCount.textContent = `${items.length} Episodes`;

            if (items.length === 0) {
                episodeListContainer.innerHTML = '<div style="text-align:center; padding:2rem;">No episodes found.</div>';
            } else {
                episodeListContainer.innerHTML = ''; // Clear
                items.forEach((item, index) => {
                    const title = getTagValue(item, "title");
                    const pubDate = new Date(getTagValue(item, "pubDate")).toLocaleDateString('th-TH', {
                        year: 'numeric', month: 'short', day: 'numeric'
                    });
                    const desc = getTagValue(item, "description").replace(/<[^>]*>?/gm, '').substring(0, 150) + '...';

                    const enclosure = item.querySelector("enclosure");
                    const audioUrl = enclosure ? enclosure.getAttribute("url") : null;

                    // Episode Image
                    let epImage = podcastImage;
                    const epItunesImage = item.getElementsByTagNameNS("http://www.itunes.com/dtds/podcast-1.0.dtd", "image")[0];
                    if (epItunesImage) epImage = epItunesImage.getAttribute("href");

                    if (audioUrl) {
                        const card = document.createElement('div');
                        card.className = 'episode-item';
                        card.innerHTML = `
                            <div class="ep-date">${pubDate}</div>
                            <div class="ep-title">${title}</div>
                            <div class="ep-desc">${desc}</div>
                            <div class="ep-meta">
                                <div class="play-btn-small">
                                    <span>▶</span> Play
                                </div>
                                <!-- <span style="font-size:0.75rem; color:var(--secondary-text)">Details</span> -->
                            </div>
                        `;

                        card.addEventListener('click', () => {
                            playEpisode(title, audioUrl, epImage, card);
                        });

                        episodeListContainer.appendChild(card);
                    }
                });
            }

            // Hide loading
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);

        })
        .catch(err => {
            console.error(err);
            loadingScreen.innerHTML = `<div style="text-align:center; padding:20px;">Error loading feed:<br>${err.message}<br><br>Please try again later.</div>`;
        });

    // --- Scroll Effect for Nav Title ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            navTitle.style.opacity = '1';
        } else {
            navTitle.style.opacity = '0';
        }
    });

    // --- Helper Functions ---
    function getTagValue(parent, tagName) {
        const tag = parent.querySelector(tagName);
        return tag ? tag.textContent.trim() : '';
    }

    function playEpisode(title, url, image, cardElement) {
        // Update Player UI
        playerTitle.textContent = title;
        playerCover.src = image;
        mainAudio.src = url;

        // Play
        mainAudio.play().catch(e => console.log("Autoplay prevented", e));

        // Show Sticky Player
        stickyPlayer.classList.add('visible');

        // Update Active State in List
        document.querySelectorAll('.episode-item').forEach(el => {
            el.classList.remove('active');
            const btn = el.querySelector('.play-btn-small');
            if (btn) btn.innerHTML = '<span>▶</span> Play';
        });

        if (cardElement) {
            cardElement.classList.add('active');
            const btn = cardElement.querySelector('.play-btn-small');
            if (btn) btn.innerHTML = '<span>II</span> Playing';
        }
    }
});
