const { WebcastChat } = require('tiktok-live-connector');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });

wss.on('connection', (ws) => {
    let currentStream = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Khi khách nhập tên kênh TikTok từ web Netlify gửi lên server
            if (data.action === 'set_username' && data.username) {
                if (currentStream) {
                    currentStream.disconnect(); 
                }
                
                const tiktokUsername = data.username;
                currentStream = new WebcastChat(tiktokUsername);

                currentStream.connect().then(state => {
                    console.log(`Đã kết nối phòng Live: ${state.roomInfo.owner.uniqueId}`);
                    ws.send(JSON.stringify({ status: 'connected', room: state.roomInfo.owner.uniqueId }));
                }).catch(err => {
                    ws.send(JSON.stringify({ status: 'error', message: 'Không thể kết nối (Kênh không live hoặc sai tên)' }));
                });

                // Lắng nghe bình luận (5 comment = 1 bước)
                let commentCount = 0;
                currentStream.on('chat', chatData => {
                    let msg = chatData.comment.trim();
                    if (['1', '2', '3', '4', '5', 'vn', 'th', 'kr', 'my', 'id'].includes(msg.toLowerCase())) {
                        commentCount++;
                        if (commentCount >= 5) {
                            commentCount = 0;
                            let country = 'vn';
                            if (msg === '2' || msg === 'th') country = 'th';
                            else if (msg === '3' || msg === 'kr') country = 'kr';
                            else if (msg === '4' || msg === 'my') country = 'my';
                            else if (msg === '5' || msg === 'id') country = 'id';

                            ws.send(JSON.stringify({ country: country, steps: 1 }));
                        }
                    }
                });

                // Lắng nghe quà tặng theo đúng mốc quy ước
                currentStream.on('gift', giftData => {
                    if (giftData.giftType === 1 && !giftData.repeatEnd) return;
                    const diamonds = giftData.diamondCount * giftData.repeatCount;
                    
                    let steps = 6; // Quà nhỏ
                    if (diamonds >= 500) steps = 60;      // Siêu to
                    else if (diamonds >= 100) steps = 25; // To mốc 100 xu
                    else if (diamonds >= 20) steps = 15;  // To

                    ws.send(JSON.stringify({ country: 'vn', steps: steps }));
                });
            }
        } catch (e) {
            console.log(e);
        }
    });

    ws.on('close', () => {
        if (currentStream) currentStream.disconnect();
    });
});