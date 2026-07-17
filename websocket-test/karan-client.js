const { io } = require('socket.io-client');

// Paste Karan's fresh access token here
const KARAN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjMTgzOGFmNS01YTYyLTQyYTMtYmY4Ny04MzkwNDJjYTQwOTQiLCJlbWFpbCI6ImthcmFuQHRlc3QuY29tIiwiaWF0IjoxNzg0Mjc3MTE2LCJleHAiOjE3ODQyNzgwMTZ9.FYVEiY43k5iGeiTv54tHKFMocifA_USzF5LhoNLd5TM';

const socket = io('http://localhost:3000', {
  auth: {
    token: KARAN_TOKEN,
  },
});

socket.on('connect', () => {
  console.log('✅ Karan connected:', socket.id);
});

socket.on('message:new', (message) => {
  console.log('📩 Karan received a new message:', message);
});

socket.on('disconnect', () => {
  console.log('❌ Karan disconnected');
});

socket.on('connect_error', (error) => {
  console.log('⚠️ Connection error:', error.message);
});

socket.on('connect', () => {
  console.log('✅ Karan connected:', socket.id);

  // Send a message 2 seconds after connecting
  setTimeout(() => {
    socket.emit(
      'message:send',
      {
        conversationId: '54dfee51-58c0-4222-bacf-cf92f193f8b2',
        content: 'Real-time message via WebSocket!',
      },
      (response) => {
        console.log('✅ Message sent, server confirmed:', response);
      },
    );
  }, 2000);
});