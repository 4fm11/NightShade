// ثوابت التطبيق
const API_KEY = "Y8B749ATHlYrRAqAHbn7VVEWVn8ORwzF";
const API_ENDPOINT = "https://api.deepinfra.com/v1/openai/chat/completions";
const MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.1";
// ثوابت الملفات المسموحة
const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/javascript',
    'application/javascript',
    'text/x-lua',
    'text/html',
    'text/css',
    'application/zip',
    'application/x-rar-compressed'
];

const ALLOWED_FILE_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', 
    '.js', '.lua', '.html', '.css', '.zip', '.rar'
];

// إضافة هذه المتغيرات في بداية الملف
let conversationHistory = [];
let currentConversationId = null;

// تحديث دالة sendMessage
async function sendMessage() {
    const message = chatInput.value.trim();
    if (message === '') return;
    
    // إنشاء محادثة جديدة إذا لزم الأمر
    if (!currentConversationId) {
        currentConversationId = Date.now().toString();
    }
    
    // إضافة رسالة المستخدم إلى السجل
    const userMessage = {
        id: Date.now().toString(),
        conversationId: currentConversationId,
        content: message,
        role: 'user',
        timestamp: new Date().toISOString()
    };
    
    conversationHistory.push(userMessage);
    saveConversations();
    
    addMessage(message, true);
    chatInput.value = '';
    showLoading(true);
    
    try {
        const response = await getAIResponse(message);
        const aiMessage = {
            id: Date.now().toString(),
            conversationId: currentConversationId,
            content: response,
            role: 'assistant',
            timestamp: new Date().toISOString()
        };
        
        conversationHistory.push(aiMessage);
        saveConversations();
        
        addMessage(response, false);
    } catch (error) {
        addMessage(`❌ حدث خطأ: ${error.message}`, false);
    }
    
    showLoading(false);
}

// دالة لحفظ المحادثات
function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(conversationHistory));
}

// دالة لتحميل المحادثات
function loadConversations() {
    const saved = localStorage.getItem('conversations');
    if (saved) {
        conversationHistory = JSON.parse(saved);
    }
}

// إضافة هذه الدوال إلى script.js
async function translateText(text, targetLang = 'en') {
    try {
        const response = await getAIResponse(`Translate the following text to ${targetLang}: ${text}`);
        return response;
    } catch (error) {
        console.error("Translation error:", error);
        return text; // العودة إلى النص الأصلي في حالة الخطأ
    }
}

// إضافة زر الترجمة إلى واجهة الرسائل
function addTranslateButton(messageElement, text) {
    const translateBtn = document.createElement('button');
    translateBtn.className = 'message-action';
    translateBtn.innerHTML = '<i class="fas fa-language"></i> ترجمة';
    translateBtn.onclick = async () => {
        const translated = await translateText(text);
        addMessage(`الترجمة: ${translated}`, false);
    };
    
    messageElement.querySelector('.message-actions').appendChild(translateBtn);
}

// تعديل دالة معالجة تحميل الملفات
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // التحقق من نوع الملف
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const isTypeValid = ALLOWED_FILE_TYPES.includes(file.type) || 
                       ALLOWED_FILE_EXTENSIONS.includes(fileExtension);

    if (!isTypeValid) {
        addMessage('نوع الملف غير مدعوم. يرجى تحميل ملف من الأنواع المسموحة.', false);
        return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB حد أقصى
        addMessage('حجم الملف كبير جدًا. الحد الأقصى هو 10MB.', false);
        return;
    }

    currentFile = file;
    fileName.textContent = file.name;
    uploadedFile.style.display = 'flex';
    
    // عرض رسالة مختلفة حسب نوع الملف
    let message = `تم تحميل الملف: ${file.name}`;
    if (fileExtension === '.js') {
        message += ' (ملف JavaScript)';
    } else if (fileExtension === '.lua') {
        message += ' (ملف Lua)';
    } else if (fileExtension === '.html') {
        message += ' (ملف HTML)';
    } else if (fileExtension === '.css') {
        message += ' (ملف CSS)';
    }
    
    message += '. يمكنك الآن طرح أسئلة حول محتواه.';
    addMessage(message, false);
}

// تعديل دالة معالجة الملف مع الرسالة
async function processFileWithMessage(file, message) {
    try {
        // قراءة محتوى الملف حسب نوعه
        let content = '';
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (fileExtension === '.js' || fileExtension === '.lua' || 
            fileExtension === '.html' || fileExtension === '.css' || 
            fileExtension === '.txt') {
            // قراءة الملفات النصية
            content = await readTextFile(file);
        } else {
            // للملفات الأخرى (سيتم معالجتها بشكل مختلف)
            content = `لقد تلقيت ملف ${file.name} من نوع ${file.type}`;
        }
        
        // إرسال المحتوى مع الرسالة إلى الذكاء الاصطناعي
        const response = await getAIResponse(`الملف: ${file.name}\n\n${content}\n\nالسؤال: ${message}`);
        return response;
        
    } catch (error) {
        console.error("Error processing file:", error);
        throw new Error('حدث خطأ أثناء معالجة الملف');
    }
}

// دالة مساعدة لقراءة الملفات النصية
function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

function handleFileUpload(e) {
    // ... الكود السابق ...
    
    currentFile = file;
    
    // تحديد نوع الملف لعرضه
    let typeBadge = '';
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (fileExtension === '.js') {
        typeBadge = '<span class="file-type js-file">JS</span>';
    } else if (fileExtension === '.lua') {
        typeBadge = '<span class="file-type lua-file">Lua</span>';
    } else if (fileExtension === '.html') {
        typeBadge = '<span class="file-type html-file">HTML</span>';
    } else if (fileExtension === '.css') {
        typeBadge = '<span class="file-type css-file">CSS</span>';
    }
    
    fileName.innerHTML = typeBadge + file.name;
    uploadedFile.style.display = 'flex';
    
    // ... باقي الكود ...
}
// عناصر DOM الرئيسية
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const fileUpload = document.getElementById('fileUpload');
const uploadedFile = document.getElementById('uploadedFile');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const darkModeToggle = document.getElementById('darkModeToggle');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginSubmit = document.getElementById('loginSubmit');
const signupSubmit = document.getElementById('signupSubmit');
const closeLoginModal = document.getElementById('closeLoginModal');
const closeSignupModal = document.getElementById('closeSignupModal');
const showSignupLink = document.getElementById('showSignupLink');
const showLoginLink = document.getElementById('showLoginLink');

// متغيرات التطبيق
let currentFile = null;
let recognition = null;

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    addWelcomeMessage();
    checkAuthStatus();
    setupEventListeners();
    initializeVoiceRecognition();
});

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // أحداث الدردشة
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // أحداث الملفات
    fileUpload.addEventListener('change', handleFileUpload);
    removeFile.addEventListener('click', removeUploadedFile);
    
    // أحداث المودال
    loginBtn.addEventListener('click', () => showModal('loginModal'));
    signupBtn.addEventListener('click', () => showModal('signupModal'));
    logoutBtn.addEventListener('click', logout);
    loginSubmit.addEventListener('click', login);
    signupSubmit.addEventListener('click', signup);
    closeLoginModal.addEventListener('click', () => closeModal('loginModal'));
    closeSignupModal.addEventListener('click', () => closeModal('signupModal'));
    showSignupLink.addEventListener('click', () => {
        closeModal('loginModal');
        showModal('signupModal');
    });
    showLoginLink.addEventListener('click', () => {
        closeModal('signupModal');
        showModal('loginModal');
    });
    
    // حدث تبديل الوضع الليلي
    darkModeToggle.addEventListener('click', toggleDarkMode);
}

// إنشاء جسيمات الخلفية المتحركة
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
    }
}

// إضافة رسالة ترحيبية
function addWelcomeMessage() {
    setTimeout(() => {
        const welcomeMessage = `
            <div class="message ai-message">
                <div class="message-content">
                    <h3 style="margin-bottom: 0.5rem;">مرحباً بك في Raven information!</h3>
                    <p>أنا مساعدك الذكي الذي يمكنه:</p>
                    <ul style="margin-top: 0.5rem; padding-right: 1rem;">
                        <li>الإجابة على أسئلتك بدقة عالية</li>
                        <li>تحليل الملفات (PDF, Word, Excel)</li>
                        <li>التعرف على الصوت والرد صوتيًا</li>
                        <li>إنشاء المحتوى والبرامج النصية</li>
                    </ul>
                    <p style="margin-top: 0.5rem;">كيف يمكنني مساعدتك اليوم؟</p>
                </div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
                <div class="message-actions">
                    <button class="message-action" onclick="copyToClipboard(this.parentElement.parentElement)">
                        <i class="far fa-copy"></i> نسخ
                    </button>
                    <button class="message-action" onclick="speakText(this.parentElement.parentElement.querySelector('.message-content').textContent)">
                        <i class="fas fa-volume-up"></i> نطق
                    </button>
                </div>
            </div>
        `;
        chatMessages.innerHTML += welcomeMessage;
    }, 500);
}

// إضافة رسالة إلى الدردشة
function addMessage(text, isUser) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    const timeString = new Date().toLocaleTimeString();
    
    messageElement.innerHTML = `
        <div class="message-content">${formatMessageText(text)}</div>
        <div class="message-time">${timeString}</div>
        <div class="message-actions">
            <button class="message-action" onclick="copyToClipboard(this.parentElement.parentElement)">
                <i class="far fa-copy"></i> نسخ
            </button>
            ${!isUser ? `<button class="message-action" onclick="speakText(this.parentElement.parentElement.querySelector('.message-content').textContent)">
                <i class="fas fa-volume-up"></i> نطق
            </button>` : ''}
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// تنسيق نص الرسالة
function formatMessageText(text) {
    // تحويل الروابط إلى روابط قابلة للنقر
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // تحويل النقاط إلى قوائم
    text = text.replace(/\n-/g, '\n• ');
    
    // تحويل الأسطر الجديدة إلى فقرات
    text = text.replace(/\n\n/g, '</p><p>');
    
    return `<p>${text}</p>`;
}

// عرض مؤشر التحميل
function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

// اختيار اقتراح
function selectSuggestion(text) {
    chatInput.value = text;
    chatInput.focus();
}

// إرسال رسالة
async function sendMessage() {
    const message = chatInput.value.trim();
    
    if (message === '') return;
    
    // إضافة رسالة المستخدم
    addMessage(message, true);
    chatInput.value = '';
    showLoading(true);
    
    try {
        let response;
        if (currentFile) {
            response = await processFileWithMessage(currentFile, message);
        } else {
            response = await getAIResponse(message);
        }
        
        // إضافة رد الذكاء الاصطناعي
        addMessage(response, false);
    } catch (error) {
        addMessage(`❌ حدث خطأ: ${error.message}`, false);
    }
    
    showLoading(false);
}

// الحصول على رد من الذكاء الاصطناعي
async function getAIResponse(prompt) {
    const body = {
        model: MODEL_NAME,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
    };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || "حدث خطأ في الاتصال بالخادم");
        }
        
        return data.choices?.[0]?.message?.content || "⚠️ لا يوجد رد.";
    } catch (error) {
        console.error("Error getting AI response:", error);
        throw error;
    }
}

// معالجة الملف مع الرسالة
async function processFileWithMessage(file, message) {
    // في التطبيق الحقيقي، هنا يتم تحميل الملف ومعالجته مع الرسالة
    // هذا مثال محاكاة فقط
    return `لقد تلقيت ملف ${file.name} مع السؤال: "${message}". هذا رد محاكاة. في التطبيق الحقيقي، سيتم تحليل الملف والإجابة بناءً على محتواه.`;
}

// التعامل مع تحميل الملف
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB حد أقصى
            addMessage('الملف كبير جدًا. الحد الأقصى للحجم هو 5MB.', false);
            return;
        }
        
        currentFile = file;
        fileName.textContent = file.name;
        uploadedFile.style.display = 'flex';
        addMessage(`تم تحميل الملف: ${file.name}. يمكنك الآن طرح أسئلة حول محتواه.`, false);
    }
}

// إزالة الملف المرفق
function removeUploadedFile() {
    currentFile = null;
    fileUpload.value = '';
    uploadedFile.style.display = 'none';
    addMessage('تم إزالة الملف المرفق.', false);
}

// تهيئة التعرف على الصوت
function initializeVoiceRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'ar-SA';
        
        recognition.onstart = () => {
            voiceBtn.classList.add('voice-recording');
            voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        };
        
        recognition.onend = () => {
            voiceBtn.classList.remove('voice-recording');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
        };
        
        recognition.onerror = (event) => {
            console.error('حدث خطأ في التعرف على الصوت:', event.error);
            addMessage('حدث خطأ في التعرف على الصوت. يرجى المحاولة مرة أخرى.', false);
        };
        
        voiceBtn.addEventListener('click', toggleVoiceRecognition);
    } else {
        voiceBtn.style.display = 'none';
        console.warn('API التعرف على الصوت غير مدعوم في هذا المتصفح');
    }
}

// تبديل التعرف على الصوت
function toggleVoiceRecognition() {
    if (voiceBtn.classList.contains('voice-recording')) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (error) {
            addMessage('لا يمكن بدء التعرف على الصوت. يرجى التحقق من إذن الميكروفون.', false);
        }
    }
}

// نسخ النص إلى الحافظة
function copyToClipboard(element) {
    const text = element.querySelector('.message-content').textContent;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = element.querySelector('.message-action').innerHTML;
        element.querySelector('.message-action').innerHTML = '<i class="fas fa-check"></i> تم النسخ!';
        setTimeout(() => {
            element.querySelector('.message-action').innerHTML = originalText;
        }, 2000);
    });
}

// نطق النص
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        speechSynthesis.speak(utterance);
    } else {
        addMessage('ميزة النطق غير مدعومة في متصفحك', false);
    }
}

// تبديل الوضع الليلي
function toggleDarkMode() {
    document.body.classList.toggle('light-mode');
    if (document.body.classList.contains('light-mode')) {
        localStorage.setItem('darkMode', 'light');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        localStorage.setItem('darkMode', 'dark');
        darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// التحقق من تفضيلات الوضع الليلي
function checkDarkModePreference() {
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedMode = localStorage.getItem('darkMode');
    
    if (savedMode === 'light' || (!savedMode && !prefersDarkMode)) {
        document.body.classList.add('light-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// وظائف المودال
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    clearErrors(modalId);
}

function clearErrors(modalId) {
    const errorElements = document.querySelectorAll(`#${modalId} .error-message`);
    errorElements.forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

// وظائف المصادقة
function checkAuthStatus() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const user = JSON.parse(localStorage.getItem('currentUser'));

    if (user) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
    } else {
        authButtons.style.display = 'flex';
        userInfo.style.display = 'none';
    }
}

function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    let isValid = true;

    // التحقق من صحة البريد الإلكتروني
    if (!email) {
        showError('loginEmailError', 'البريد الإلكتروني مطلوب');
        isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
        showError('loginEmailError', 'البريد الإلكتروني غير صالح');
        isValid = false;
    }

    // التحقق من صحة كلمة المرور
    if (!password) {
        showError('loginPasswordError', 'كلمة المرور مطلوبة');
        isValid = false;
    }

    if (!isValid) return;

    // التحقق من وجود المستخدم
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        // حفظ بيانات المستخدم الحالي
        localStorage.setItem('currentUser', JSON.stringify(user));
        closeModal('loginModal');
        checkAuthStatus();
        addMessage(`مرحباً بعودتك، ${user.name}! كيف يمكنني مساعدتك اليوم؟`, false);
    } else {
        showError('loginPasswordError', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
}

function signup() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const confirmPassword = document.getElementById('signupConfirmPassword').value.trim();
    let isValid = true;

    // التحقق من صحة الاسم
    if (!name) {
        showError('signupNameError', 'الاسم الكامل مطلوب');
        isValid = false;
    }

    // التحقق من صحة البريد الإلكتروني
    if (!email) {
        showError('signupEmailError', 'البريد الإلكتروني مطلوب');
        isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
        showError('signupEmailError', 'البريد الإلكتروني غير صالح');
        isValid = false;
    }

    // التحقق من صحة كلمة المرور
    if (!password) {
        showError('signupPasswordError', 'كلمة المرور مطلوبة');
        isValid = false;
    } else if (password.length < 6) {
        showError('signupPasswordError', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        isValid = false;
    }

    // التحقق من تطابق كلمة المرور
    if (password !== confirmPassword) {
        showError('signupConfirmPasswordError', 'كلمة المرور غير متطابقة');
        isValid = false;
    }

    if (!isValid) return;

    // التحقق من عدم وجود البريد الإلكتروني مسبقاً
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const emailExists = users.some(u => u.email === email);

    if (emailExists) {
        showError('signupEmailError', 'هذا البريد الإلكتروني مسجل بالفعل');
        return;
    }

    // إنشاء مستخدم جديد
    const newUser = {
        id: Date.now().toString(),
        name: name,
        email: email,
        password: password
    };

    // حفظ المستخدم
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(newUser));

    closeModal('signupModal');
    checkAuthStatus();
    addMessage(`مرحباً بك، ${name}! شكراً لانضمامك إلينا. كيف يمكنني مساعدتك اليوم؟`, false);
}

function logout() {
    localStorage.removeItem('currentUser');
    checkAuthStatus();
    addMessage('تم تسجيل الخروج بنجاح. نأمل أن تكون قد استمتعت بتجربتك معنا!', false);
}