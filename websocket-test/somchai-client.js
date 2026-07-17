const { io } = require('socket.io-client');

const SOMCHAI_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOTJlYzYwYy05NjFhLTQ2OWUtOTE5OC1kNjJmZmJkODkzOWYiLCJlbWFpbCI6InNvbWNoYWlAdGVzdC5jb20iLCJpYXQiOjE3ODQyNzcxNTcsImV4cCI6MTc4NDI3ODA1N30.zIAaEmtWi1107BilV2ugUf_lFIuGYy5xgGw4rmR2VII';

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

socket.on('disconnect', () => {
  console.log('❌ Somchai disconnected');
});

socket.on('connect_error', (error) => {
  console.log('⚠️ Connection error:', error.message);
});