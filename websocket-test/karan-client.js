const { io } = require('socket.io-client');

const KARAN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjMTgzOGFmNS01YTYyLTQyYTMtYmY4Ny04MzkwNDJjYTQwOTQiLCJlbWFpbCI6ImthcmFuQHRlc3QuY29tIiwiaWF0IjoxNzg0MjgzMzEwLCJleHAiOjE3ODQyODQyMTB9.AZDY92fytB8BXnLhmjCsoF4PI0PTajbJPMOH0ugCrak';

const socket = io('http://localhost:3000', {
  auth: {
    token: KARAN_TOKEN,
  },
});

socket.on('connect', () => {
  console.log('✅ Karan connected:', socket.id);

  // Step 1: Send a message after 2 seconds
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

  // Step 2: Mark conversation as read after 4 seconds
  setTimeout(() => {
    console.log('📤 Karan marking conversation as read...');
    socket.emit('message:read', {
      conversationId: '54dfee51-58c0-4222-bacf-cf92f193f8b2',
    });
  }, 4000);
});

socket.on('message:new', (message) => {
  console.log('📩 Karan received a new message:', message);
});

socket.on('message:read', (data) => {
  console.log('✅ Karan: message was read!', data);
});

socket.on('friend:request', (data) => {
  console.log('👋 Karan: received a friend request!', data);
});

socket.on('disconnect', () => {
  console.log('❌ Karan disconnected');
});

socket.on('connect_error', (error) => {
  console.log('⚠️ Connection error:', error.message);
});