document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('mainVideo');
    const container = document.querySelector('.player-container');
    const controlsOverlay = document.getElementById('controlsOverlay');
    const progressBar = document.querySelector('.progress-fill');
    const timeDisplay = document.querySelector('.time-display');
    const statsCanvas = document.getElementById('statsCanvas');
    const feedbackLeft = document.getElementById('feedbackLeft');
    const feedbackRight = document.getElementById('feedbackRight');
    const dragFeedback = document.getElementById('dragFeedback'); // 드래그 애니메이션용
    
    // 버튼
    const playToggleBtn = document.getElementById('playToggleBtn');
    const seekBackBtn = document.getElementById('seekBackBtn');
    const seekFwdBtn = document.getElementById('seekFwdBtn');
    const fullScreenBtn = document.getElementById('fullScreenBtn');

    // 통계 시각화 (목 데이터)
    function generateStatsData() {
        const data = [];
        for (let i = 0; i < 100; i++) {
            let val = Math.max(0, 100 - i + (Math.random() * 20 - 10));
            if (i > 30 && i < 50) val += 30; // 피크 구간
            data.push(val);
        }
        return data;
    }

    function drawStats(data) {
        const ctx = statsCanvas.getContext('2d');
        const width = statsCanvas.offsetWidth;
        const height = statsCanvas.offsetHeight;
        statsCanvas.width = width;
        statsCanvas.height = height;

        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(0, height);

        const step = width / (data.length - 1);
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(229, 9, 20, 0.6)');
        gradient.addColorStop(1, 'rgba(229, 9, 20, 0.1)');
        ctx.fillStyle = gradient;

        for (let i = 0; i < data.length; i++) {
            const x = i * step;
            const y = height - (data[i] / 150 * height);
            ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
    }

    drawStats(generateStatsData());
    window.addEventListener('resize', () => drawStats(generateStatsData()));


    // --- 미디어 제어 로직 ---

    function togglePlay() {
        if (video.paused) {
            video.play();
            container.classList.remove('video-paused');
        } else {
            video.pause();
            container.classList.add('video-paused');
        }
    }

    function seek(amount) {
        video.currentTime = Math.min(Math.max(video.currentTime + amount, 0), video.duration);
    }

    video.addEventListener('timeupdate', () => {
        const percent = (video.currentTime / video.duration) * 100;
        progressBar.style.width = `${percent}%`;
        const current = formatTime(video.currentTime);
        const total = formatTime(video.duration || 0);
        timeDisplay.textContent = `${current} / ${total}`;
    });

    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0'+s : s}`;
    }

    // --- 상호작용 리스너 ---

    // 재생 버튼 클릭
    playToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay();
    });

    // 탐색 버튼 클릭
    seekBackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        seek(-10);
        showFeedback(feedbackLeft);
    });

    seekFwdBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        seek(10);
        showFeedback(feedbackRight);
    });

    // 키보드 단축키
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.code) {
            case 'Space':
                e.preventDefault(); 
                togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                seek(-10);
                showFeedback(feedbackLeft);
                break;
            case 'ArrowRight':
                e.preventDefault();
                seek(10);
                showFeedback(feedbackRight);
                break;
            case 'Enter':
                e.preventDefault();
                toggleFullScreen();
                break;
        }
    });

    // 전체화면 토글 함수
    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // 전체화면 버튼 클릭
    if(fullScreenBtn) {
        fullScreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFullScreen();
        });
    }

    // --- 제스처 로직 ---
    let lastTapTime = 0;
    let initialX = null;
    let initialTime = null;
    let isDragging = false;
    let tapTimeout = null; // 싱글 탭과 더블 탭 구분을 위한 타이머
    let pendingSeekTime = null; // 드래그 해제 시 이동할 목표 시간
    const doubleTapDelay = 300; 

    container.addEventListener('mousedown', handleStart);
    container.addEventListener('touchstart', handleStart, {passive: false});

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, {passive: false});

    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);


    function handleStart(e) {
        if (e.target.closest('button')) return;

        const currentTime = new Date().getTime();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const width = container.offsetWidth; 
        const rect = container.getBoundingClientRect();
        const xPos = clientX - rect.left;

        // 더블 탭 확인
        if (currentTime - lastTapTime < doubleTapDelay && !isDragging) {
            clearTimeout(tapTimeout); // 싱글 탭 동작 취소
            handleDoubleTap(xPos, width); 
            lastTapTime = 0; 
            return;
        }
        lastTapTime = currentTime;

        // 드래그 시작
        initialX = clientX;
        initialTime = video.currentTime;
        isDragging = true;
        pendingSeekTime = null;
    }

    function handleDoubleTap(x, width) {
        if (x < width * 0.35) {
            seek(-10);
            showFeedback(feedbackLeft);
        } else if (x > width * 0.65) {
            seek(10);
            showFeedback(feedbackRight);
        } else {
            togglePlay();
        }
    }

    function showFeedback(element, text = null) {
        if (text) element.textContent = text;
        element.classList.add('show');
        setTimeout(() => element.classList.remove('show'), 500);
    }
    
    // 드래그 중 피드백을 유지하기 위한 헬퍼 함수
    function updateDragFeedback(targetTime) {
        dragFeedback.textContent = formatTime(targetTime);
        dragFeedback.classList.add('show');
    }

    function hideDragFeedback() {
        dragFeedback.classList.remove('show');
    }

    function handleMove(e) {
        resetInactivityTimer();
        
        if (!isDragging) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const diffX = clientX - initialX;

        // 클릭이 아닌 드래그로 간주할 임계값
        if (Math.abs(diffX) > 10) {
             // 드래그이므로 대기 중인 싱글 탭 취소
             clearTimeout(tapTimeout);
             
             const width = container.offsetWidth;
             const percentageChange = diffX / width;
             // 드래그 탐색 범위를 0과 영상 길이 사이로 제한
             let targetTime = initialTime + (percentageChange * video.duration);
             targetTime = Math.max(0, Math.min(targetTime, video.duration));
             
             pendingSeekTime = targetTime;
             
             // 영상은 즉시 업데이트하지 않음 (사용자 요청)
             // video.currentTime = targetTime; 
             
             // 피드백 표시 (절대 시간)
             updateDragFeedback(targetTime);
        }
        
        if(e.cancelable) e.preventDefault();
    }

    function handleEnd(e) {
        if (isDragging) {
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const diffX = clientX - initialX;
            
            if (Math.abs(diffX) < 10) {
                // 클릭 (탭) 이었음
                 tapTimeout = setTimeout(() => {
                    togglePlay();
                }, doubleTapDelay);
            } else if (pendingSeekTime !== null) {
                // 드래그였음, 이제 탐색 실행
                video.currentTime = pendingSeekTime;
            }

            isDragging = false;
            pendingSeekTime = null;
            hideDragFeedback();
        }
    }

    // 타임라인 직접 탐색
    const timeline = document.querySelector('.timeline-container');
    timeline.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = timeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        video.currentTime = percent * video.duration;
    });

    // --- 썸네일 미리보기 로직 ---
    const thumbnailVideo = document.getElementById('thumbnailVideo');
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    const thumbnailCanvas = document.getElementById('thumbnailCanvas');
    const thumbnailTime = document.getElementById('thumbnailTime');
    const ctx = thumbnailCanvas.getContext('2d');
    
    // 쓰로틀링 함수 (성능 최적화)
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    const updateThumbnail = throttle((e) => {
        const rect = timeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        // 범위 체크
        if (x < 0 || x > width) return;

        const percent = x / width;
        const targetTime = percent * video.duration;
        
        // 미리보기 위치 설정 (마우스 위치 기준, 화면 밖으로 나가지 않게 조정)
        let leftPos = x - 80; // 160px 너비의 절반인 80px를 뺌 (중앙 정렬)
        leftPos = Math.max(0, Math.min(leftPos, width - 160)); // 화면 경계 체크
        
        thumbnailPreview.style.left = `${leftPos}px`;
        thumbnailTime.textContent = formatTime(targetTime);
        thumbnailPreview.classList.add('show');

        // 비디오 탐색 (쓰로틀링 적용됨)
        if (Number.isFinite(targetTime)) {
             // seeking 중에는 요청하지 않음 (부하 방지)
             if (!thumbnailVideo.seeking) {
                 thumbnailVideo.currentTime = targetTime;
             }
        }
    }, 200); // 0.2초마다 업데이트

    // 비디오 탐색 완료 시 캔버스에 그리기
    thumbnailVideo.addEventListener('seeked', () => {
        ctx.drawImage(thumbnailVideo, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    });

    timeline.addEventListener('mousemove', updateThumbnail);
    
    timeline.addEventListener('mouseleave', () => {
        thumbnailPreview.classList.remove('show');
    });


    // --- 컨트롤 자동 숨김 로직 ---
    let inactivityTimer;

    function resetInactivityTimer() {
        controlsOverlay.classList.remove('hide-controls');
        
        clearTimeout(inactivityTimer);

        if (!video.paused) {
            inactivityTimer = setTimeout(() => {
                controlsOverlay.classList.add('hide-controls');
            }, 3000);
        }
    }

    container.addEventListener('mousemove', resetInactivityTimer);
    container.addEventListener('click', resetInactivityTimer);
    container.addEventListener('touchstart', resetInactivityTimer);
    document.addEventListener('keydown', resetInactivityTimer);

    resetInactivityTimer();
    
    video.addEventListener('play', resetInactivityTimer);
    video.addEventListener('pause', () => {
        clearTimeout(inactivityTimer);
        controlsOverlay.classList.remove('hide-controls');
    });

});
