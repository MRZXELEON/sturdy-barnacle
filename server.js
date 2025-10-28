const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище данных
let appData = {
  polls: [],
  messages: [],
  competitions: [],
  userVotes: {},
  chatMessages: [],
  competitionResults: {},
  galleryMedia: [],
  users: []
};

// Предопределенные аккаунты
const accounts = [
  { username: "София", password: "40237", isAdmin: false },
  { username: "степа", password: "04847849", isAdmin: false },
  { username: "егор", password: "6687430", isAdmin: false },
  { username: "леонид", password: "ораш864", isAdmin: true },
  { username: "бабушка", password: "баб8901", isAdmin: true },
  { username: "деда", password: "0987654321", isAdmin: false }
];

// API Routes
app.get('/api/data', (req, res) => {
  res.json(appData);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const account = accounts.find(acc => 
    acc.username.toLowerCase() === username.toLowerCase() && 
    acc.password === password
  );
  
  if (account) {
    res.json({ success: true, user: account });
  } else {
    res.json({ success: false, error: 'Неверный логин или пароль' });
  }
});

app.post('/api/save-data', (req, res) => {
  const { data, type } = req.body;
  
  if (appData[type] !== undefined) {
    appData[type] = data;
    
    // Рассылаем обновление всем подключенным клиентам
    io.emit('data-update', { type, data });
    
    res.json({ success: true });
  } else {
    res.json({ success: false, error: 'Неверный тип данных' });
  }
});

// Socket.io для реального времени
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);
  
  // Отправляем текущие данные новому клиенту
  socket.emit('initial-data', appData);
  
  // Обработка новых сообщений в чате
  socket.on('new-chat-message', (message) => {
    if (!appData.chatMessages) {
      appData.chatMessages = [];
    }
    
    const newMessage = {
      id: Date.now(),
      text: message.text,
      sender: message.sender,
      timestamp: new Date(),
      isOwn: false // Для других пользователей сообщение не их
    };
    
    appData.chatMessages.push(newMessage);
    
    // Рассылаем сообщение всем клиентам
    io.emit('new-chat-message', newMessage);
  });
  
  // Обработка новых опросов
  socket.on('new-poll', (poll) => {
    if (!appData.polls) {
      appData.polls = [];
    }
    
    appData.polls.push(poll);
    io.emit('new-poll', poll);
  });
  
  // Обработка голосов в опросах
  socket.on('vote-poll', (data) => {
    const { pollId, optionText, username } = data;
    const poll = appData.polls.find(p => p.id === pollId);
    
    if (poll && !poll.voters.includes(username)) {
      const option = poll.options.find(o => o.text === optionText);
      if (option) {
        option.votes++;
        poll.voters.push(username);
        io.emit('poll-updated', poll);
      }
    }
  });
  
  // Обработка новых соревнований
  socket.on('new-competition', (competition) => {
    if (!appData.competitions) {
      appData.competitions = [];
    }
    
    appData.competitions.push(competition);
    io.emit('new-competition', competition);
  });
  
  // Обработка участия в соревнованиях
  socket.on('participate-competition', (data) => {
    const { competitionId, username } = data;
    const competition = appData.competitions.find(c => c.id === competitionId);
    
    if (competition && !competition.participants.includes(username)) {
      competition.participants.push(username);
      io.emit('competition-updated', competition);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
