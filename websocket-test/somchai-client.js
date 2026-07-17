const { io } = require('socket.io-client');

const SOMCHAI_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOTJlYzYwYy05NjFhLTQ2OWUtOTE5OC1kNjJmZmJkODkzOWYiLCJlbWFpbCI6InNvbWNoYWlAdGVzdC5jb20iLCJpYXQiOjE3ODQyODMzMzksImV4cCI6MTc4NDI4NDIzOX0.e-gBvgxE8T3413dqbFBC-Cl9R-OgR7hyzMOCY1yQ-XQ';

const socket = io('http://localhost:3000', {
  auth: {
    token: SOMCHAI_TOKEN,
  },
});

socket.on('connect', () => {
  console.log('✅ Somchai connected:', socket.id);
});

socket.on('message:new', (message) => {
  console.log('📩 Somchai received a new message:', message);
});

socket.on('message:read', (data) => {
  console.log('✅ Somchai: message was read!', data);
});

socket.on('friend:request', (data) => {
  console.log('👋 Somchai: received a friend request!', data);
});

socket.on('disconnect', () => {
  console.log('❌ Somchai disconnected');
});

socket.on('connect_error', (error) => {
  console.log('⚠️ Connection error:', error.message);
});