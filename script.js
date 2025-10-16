// Firebase configuration (replace with your own)
// IMPORTANT: Move these to environment variables for security!
const firebaseConfig = {
  // PASTE YOUR **ACTUAL** FIREBASE CONFIGURATION OBJECT HERE.
  // The key below is just an example.
  apiKey: "AIzaSyD2WZzG7y3HPnR9xpD_bWt73BUtbL8x7YY",
  authDomain: "myfit-234ed.firebaseapp.com",
  projectId: "myfit-234ed",
  storageBucket: "myfit-234ed.appspot.com",
  messagingSenderId: "589661616240",
  appId: "1:589661616240:web:e20ff2c9e466cab0a05cb5",
  measurementId: "G-SWD9YS45YC"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// App Data - will be populated by fetching app_data.json
let workoutData = {};
let exerciseDetails = {};
let achievementsData = {};
let dietData = {};

// User-specific data - will be managed by Firebase
let currentUser = null; // This will hold user profile data from Firestore
let firebaseUser = null; // This will hold the Firebase auth user object

let notifications = []; // Will be populated from Firestore
let workoutHistory = []; // Will be populated from Firestore

// AI Coach variables
let poseDetector = null;
let webcamStream = null;
let animationFrameId = null;
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('pose-canvas');

// State for the diet plan page
let dietPlanState = {};
let lastSpokenFeedback = "";
let currentExerciseIdForCoach = null;
let repCounter = 0;
let exerciseState = 'up'; // e.g., 'up' or 'down' for squats

// Feature 1: User Registration & Profile Management
async function registerUser(name, email, password, fitnessLevel, fitnessGoals) {
    try {
        // Create user with Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        const newUserProfile = {
            id: user.uid, // Use Firebase UID as the document ID
            name,
            email,
            fitnessLevel,
            fitnessGoals,
            joined: new Date().toISOString(),
            completedWorkouts: [],
            streak: 0,
            lastWorkoutDate: null,
            role: 'user'
        };

        await db.collection('users').doc(user.uid).set(newUserProfile);

        showNotification('Registration successful!', 'success');
        // Auth state change will handle the rest (login, UI update)
        return true;

    } catch (error) {
        console.error("Registration Error:", error);
        showNotification(error.message, 'error');
        return false;
    }
}

async function loginUser(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Login successful!', 'success');
        // Auth state change will handle the rest
        return true;
    } catch (error) {
        console.error("Login Error:", error);
        showNotification(error.message, 'error');
        return false;
    }
}

async function logout() {
    try {
        await auth.signOut();
        showNotification('Logged out successfully', 'info');
        // Auth state change will handle the rest
    } catch (error) {
        console.error("Logout Error:", error);
        showNotification(error.message, 'error');
    }
}

// Listen for authentication state changes
auth.onAuthStateChanged(async user => {
    if (user) {
        // User is signed in.
        firebaseUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            currentUser = userDoc.data();
            // Fetch user-specific data
            await fetchUserData();
            await cleanupOldWorkouts(); // Clean up old data on login
        }
        updateNavigation();
        loadPage('dashboard');
    } else {
        // User is signed out.
        firebaseUser = null;
        currentUser = null;
        updateNavigation();
        loadPage('home');
    }
});

async function fetchUserData() {
    if (!firebaseUser) return;
    // Example: Fetch workout history for the current user
    const historyQuery = db.collection('workoutHistory').where('userId', '==', firebaseUser.uid).get();
    const notificationsQuery = db.collection('notifications').where('userId', '==', firebaseUser.uid).get();

    const [historySnapshot, notificationsSnapshot] = await Promise.all([historyQuery, notificationsQuery]);
    workoutHistory = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifications = notificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Deletes workout history documents older than 4 weeks for the current user.
 * This is a client-side cleanup and is best-effort.
 */
async function cleanupOldWorkouts() {
    if (!firebaseUser) return;

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const cutoffDate = fourWeeksAgo.toISOString();

    console.log(`Cleaning up workout history older than ${cutoffDate}`);

    try {
        const oldWorkoutsQuery = db.collection('workoutHistory')
            .where('userId', '==', firebaseUser.uid)
            .where('date', '<', cutoffDate);

        const snapshot = await oldWorkoutsQuery.get();

        if (snapshot.empty) {
            console.log("No old workouts to clean up.");
            return;
        }

        // Use a batched write to delete all old documents efficiently
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Successfully deleted ${snapshot.size} old workout entries.`);
    } catch (error) {
        console.error("Error during workout history cleanup:", error);
        // We don't show a notification for this as it's a background task.
    }
}

// Feature 2: Workout Tracking & Planning
async function logWorkout(workoutId) {
    if (!currentUser) return false;
    
    const workout = getAllWorkouts().find(w => w.id == workoutId);
    if (!workout) return false;
    
    // Update user's completed workouts
    if (!currentUser.completedWorkouts) currentUser.completedWorkouts = [];
    if (!currentUser.completedWorkouts.includes(workoutId)) {
        currentUser.completedWorkouts.push(workoutId);
    }
    
    // Update streak
    const today = new Date().toDateString();
    if (currentUser.lastWorkoutDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (currentUser.lastWorkoutDate === yesterday.toDateString()) {
            currentUser.streak = (currentUser.streak || 0) + 1;
        } else if (currentUser.lastWorkoutDate !== today) {
            currentUser.streak = 1;
        }
        
        currentUser.lastWorkoutDate = today;
    }
    
    // Add to workout history
    const historyEntry = {
        userId: currentUser.id, // This is now the Firebase UID
        workoutId: workoutId,
        date: new Date().toISOString(),
        calories: workout.calories
    };

    try {
        // Save to Firestore
        await db.collection('workoutHistory').add(historyEntry);
        await db.collection('users').doc(currentUser.id).update(currentUser);
        
        workoutHistory.push(historyEntry); // Update local copy
    } catch (error) {
        console.error("Error logging workout: ", error);
        showNotification('Failed to log workout.', 'error');
        return false;
    }

    showNotification(`Logged ${workout.name} workout!`, 'success');
    return true;
}

function getAllWorkouts() {
    let allWorkouts = [];
    workoutData.categories.forEach(category => {
        allWorkouts = allWorkouts.concat(category.workouts);
    });
    return allWorkouts;
}

function getLastWorkout() {
    if (!currentUser || !workoutHistory || workoutHistory.length === 0) {
        return null;
    }
    const userHistory = workoutHistory.filter(wh => wh.userId === currentUser.id);
    if (userHistory.length === 0) {
        return null;
    }
    // Sort by date descending to get the most recent entry
    const lastWorkoutEntry = userHistory.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return getAllWorkouts().find(w => w.id == lastWorkoutEntry.workoutId);
}

// Feature 3: Progress Monitoring & Analytics
function calculateTotalCalories() {
    if (!currentUser || !workoutHistory || !workoutHistory.length) return 0;
    
    const userWorkouts = workoutHistory.filter(wh => wh.userId === currentUser.id);
    return userWorkouts.reduce((total, workout) => total + workout.calories, 0);
}

function calculateAchievements() {
    if (!currentUser) return { unlocked: [], all: [] };

    const userStats = {
        'workout-count': workoutHistory.filter(wh => wh.userId === currentUser.id).length,
        'calorie-burn': calculateTotalCalories(),
        'workout-streak': currentUser.streak || 0
    };

    const allAchievements = [];
    let unlockedCount = 0;

    for (const key in achievementsData) {
        const achievement = achievementsData[key];
        const userValue = userStats[key];
        let highestTierUnlocked = null;

        achievement.tiers.forEach(tier => {
            if (userValue >= tier.threshold) {
                highestTierUnlocked = { ...tier, key: key, title: achievement.title, icon: achievement.icon, unlocked: true };
            }
        });
        if (highestTierUnlocked) unlockedCount++;
    }
    return unlockedCount;
}

// Feature 4: Notifications & Reminders
async function scheduleNotification(title, message, time, type = 'info', recurrence = 'once') {
    if (!currentUser) return null;

    const notificationData = {
        title,
        message,
        type,
        recurrence,
        time,
        userId: currentUser.id,
        createdAt: new Date().toISOString()
    };

    try {
        const docRef = await db.collection('notifications').add(notificationData);
        notifications.push({ id: docRef.id, ...notificationData }); // Update local cache
        showNotification('Reminder set successfully!', 'success');
        return docRef.id;
    } catch (error) {
        console.error("Error scheduling notification: ", error);
        showNotification('Failed to set reminder.', 'error');
        return null;
    }
}

function checkScheduledNotifications() {
    // If no user is logged in, there are no notifications to check.
    if (!currentUser) {
        return;
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const checkIntervalSeconds = 30;
    
    notifications.forEach(async (notification) => {
        const [hours, minutes] = notification.time.split(':');
        const notificationTime = parseInt(hours) * 60 + parseInt(minutes);
        
        // Check if it's time to trigger
        const timeDifference = nowMinutes - notificationTime;
        const shouldTriggerTime = timeDifference >= 0 && timeDifference < (checkIntervalSeconds / 60);

        let shouldTrigger = false;
        if (shouldTriggerTime) {
            if (notification.recurrence === 'daily') {
                shouldTrigger = true;
            } else if (notification.recurrence === 'weekly') {
                const creationDay = new Date(notification.createdAt).getDay();
                if (currentDay === creationDay) shouldTrigger = true;
            } else { // 'once'
                shouldTrigger = true;
            }
        }

        if (shouldTrigger) {
            const lastTriggered = notification.lastTriggered ? new Date(notification.lastTriggered) : null;
            // Only trigger if it hasn't been triggered today
            if (!lastTriggered || lastTriggered.toDateString() !== now.toDateString()) {
                showNotification(`${notification.title}: ${notification.message}`, notification.type);
                
                // Update lastTriggered timestamp in Firestore
                try {
                    await db.collection('notifications').doc(notification.id).update({ lastTriggered: now.toISOString() });
                    notification.lastTriggered = now.toISOString(); // Update local cache
                } catch (error) {
                    console.error("Error updating lastTriggered for notification:", error);
                }

                if (notification.recurrence === 'once') {
                    // Remove 'once' notifications after they fire
                    await db.collection('notifications').doc(notification.id).delete();
                    notifications = notifications.filter(n => n.id !== notification.id);
                }
            }
        }
    });
}

// Feature 5: Admin Dashboard
function makeUserAdmin(userId) {
    // This would now involve updating the user's role in Firestore, likely via a secure backend/cloud function.
    console.warn("makeUserAdmin needs to be implemented with secure backend logic.");
    return false;
}

// Feature 6: User Performance Tracking & Feedback
function calculatePerformanceScore(workoutId) {
    // This is a more advanced placeholder. A real app might track weight/reps over time.
    if (!currentUser || !workoutHistory) return 0;

    const workoutLogs = workoutHistory.filter(wh => wh.userId === currentUser.id && wh.workoutId == workoutId);
    if (workoutLogs.length < 2) return 60; // Base score if not enough data

    // Simple "progress" metric: give a higher score if they've done it more recently.
    const lastLogDate = new Date(workoutLogs[workoutLogs.length - 1].date);
    const daysAgo = (new Date() - lastLogDate) / (1000 * 60 * 60 * 24);

    let score = 75;
    if (daysAgo < 7) score += 15;
    if (daysAgo < 14) score += 5;

    return Math.min(95, score); // Cap score at 95
}

function calculateOverallPerformance() {
    if (!currentUser) return { score: 0, consistency: 0, intensity: 0, progress: 0 };

    const userHistory = workoutHistory.filter(wh => wh.userId === currentUser.id);
    if (userHistory.length === 0) return { score: 0, consistency: 0, intensity: 0, progress: 0 };

    // 1. Consistency: % of the last 30 days with a workout
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeDays = new Set(userHistory.filter(wh => new Date(wh.date) > thirtyDaysAgo).map(wh => new Date(wh.date).toDateString()));
    const consistency = Math.min(100, Math.round((activeDays.size / 30) * 100 * 2)); // *2 to make it feel more rewarding

    // 2. Intensity: Average difficulty of workouts
    const difficultyMap = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
    const totalDifficulty = userHistory.reduce((sum, wh) => {
        const workout = getAllWorkouts().find(w => w.id == wh.workoutId);
        return sum + (difficultyMap[workout.difficulty] || 1);
    }, 0);
    const intensity = Math.round((totalDifficulty / (userHistory.length * 3)) * 100);

    // 3. Progress: A mix of streak and total workouts
    const progress = Math.min(100, Math.round(((currentUser.streak || 0) * 2 + userHistory.length) / 50 * 100));

    const overallScore = Math.round((consistency * 0.4) + (intensity * 0.3) + (progress * 0.3));

    return { score: overallScore, consistency, intensity, progress };
}

// Feature 7: Adaptive Workout Generation
function generateAdaptiveWorkout(energyLevel, mood, timeAvailable, focusArea, count = 4) {
    const categoryScores = {};

    // Define which categories belong to which focus area
    const focusMapping = {
        'Upper Body': ['Chest', 'Back', 'Shoulders', 'Arms'],
        'Lower Body': ['Legs'],
        'Core': ['Core']
    };

    // Get workouts from the last 3 days to encourage variety
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const recentWorkouts = workoutHistory
        .filter(wh => wh.userId === currentUser.id && new Date(wh.date) > threeDaysAgo)
        .map(wh => getAllWorkouts().find(w => w.id == wh.workoutId)?.name);

    workoutData.categories.forEach(category => {
        // Filter by focus area if specified
        if (focusArea !== 'any' && !focusMapping[focusArea].includes(category.name)) {
            return; // Skip categories not in the focus area
        }

        let score = 0;
        // Prioritize based on energy level
        if (energyLevel === 'high' && ['Legs', 'Chest', 'Back'].includes(category.name)) score += 3;
        if (energyLevel === 'medium' && ['Shoulders', 'Arms', 'Core'].includes(category.name)) score += 2;
        if (energyLevel === 'low' && category.name === 'Core') score += 1; // Simple core work for low energy

        // Adjust score based on mood
        if (mood === 'energetic') score += 2;
        if (mood === 'neutral') score += 1;

        // De-prioritize recently worked categories
        const recentlyWorked = category.workouts.some(w => recentWorkouts.includes(w.name));
        if (recentlyWorked) score -= 5;

        categoryScores[category.name] = score;
    });

    // Sort categories by score
    const sortedCategories = Object.keys(categoryScores).sort((a, b) => categoryScores[b] - categoryScores[a]);

    let recommendedWorkouts = [];
    for (const categoryName of sortedCategories) {
        if (recommendedWorkouts.length >= count) break;

        const category = workoutData.categories.find(c => c.name === categoryName);
        if (!category) continue;

        const shuffledWorkouts = [...category.workouts].sort(() => 0.5 - Math.random());

        for (const workout of shuffledWorkouts) {
            if (recommendedWorkouts.length >= count) break;
            
            // Adjust sets/reps based on time
            let adjustedSets = workout.sets;
            if (timeAvailable < 20) adjustedSets = Math.max(2, (workout.sets || 3) - 1);
            if (timeAvailable > 45) adjustedSets = (workout.sets || 3) + 1;

            recommendedWorkouts.push({ ...workout, sets: adjustedSets });
        }
    }
    
    return {
        workouts: recommendedWorkouts,
        duration: timeAvailable
    };
}

// Feature 9: Gamified Workouts
async function unlockAchievement(achievementId) {
    if (!currentUser || !firebaseUser) return false;

    try {
        await db.collection('users').doc(firebaseUser.uid).update({
            achievements: firebase.firestore.FieldValue.arrayUnion(achievementId)
        });
        return true;
    } catch (error) {
        console.error("Error unlocking achievement: ", error);
    }
    return false;
}

// Utility Functions
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="me-2">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            </div>
            <div>${message}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function updateNavigation() {
    const loginNav = document.getElementById('login-nav');
    const registerNav = document.getElementById('register-nav');
    const dashboardNav = document.getElementById('dashboard-nav');
    
    if (currentUser) {
        loginNav.textContent = 'Logout';
        loginNav.setAttribute('data-page', 'logout');
        registerNav.textContent = currentUser.name.split(' ')[0];
        registerNav.setAttribute('data-page', 'dashboard');
        
        if (dashboardNav) dashboardNav.style.display = 'block';
        // Add admin link if user is admin
        if (currentUser.role === 'admin') {
            if (!document.querySelector('[data-page="admin"]')) {
                const adminNav = document.createElement('li');
                adminNav.className = 'nav-item';
                adminNav.innerHTML = '<a class="nav-link" href="#" data-page="admin">Admin</a>';
                document.getElementById('navbarNav').querySelector('.navbar-nav').insertBefore(adminNav, loginNav);
            }
        }
    } else {
        loginNav.textContent = 'Login';
        loginNav.setAttribute('data-page', 'login');
        registerNav.textContent = 'Sign Up';
        registerNav.setAttribute('data-page', 'register');
        
        if (dashboardNav) dashboardNav.style.display = 'none';

        // Remove admin link if present
        const adminLink = document.querySelector('[data-page="admin"]');
        if (adminLink) {
            adminLink.parentElement.remove();
        }
    }
}

function loadPage(page) {
    const appContent = document.getElementById('app-content');
    
    switch(page) {
        case 'home':
            appContent.innerHTML = renderHomePage();
            break;
        case 'workouts':
            appContent.innerHTML = renderWorkoutsPage();
            setupWorkoutLogging();
            setupWorkoutCardHovers();
            setupWorkoutFilters();
            break;
        case 'progress':
            appContent.innerHTML = renderProgressPage();
            initCharts();
            break;
        case 'register':
            appContent.innerHTML = renderRegisterPage();
            setupRegisterForm();
            break;
        case 'login':
            appContent.innerHTML = renderLoginPage();
            setupLoginForm();
            break;
        case 'dashboard':
            appContent.innerHTML = renderDashboard(getLastWorkout());
            setupDashboard();
            break;
        case 'notifications':
            appContent.innerHTML = renderNotificationsPage();
            setupNotifications();
            break;
        case 'adaptive':
            appContent.innerHTML = renderAdaptiveWorkoutPage();
            setupAdaptiveWorkout();
            break;
        case 'performance':
            appContent.innerHTML = renderPerformancePage();
            initPerformanceCharts();
            break;
        case 'diet':
            appContent.innerHTML = renderDietPlanPage();
            setupDietPlanPage();
            break;
        default:
            appContent.innerHTML = renderHomePage();
    }
}

function initCharts() {
    // Workout chart
    const { labels, workoutMinutesData, caloriesData } = getWeeklyChartData();
    const workoutCtx = document.getElementById('workoutChart');
    if (workoutCtx) {
        const workoutChart = new Chart(workoutCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Workout Minutes',
                    data: workoutMinutesData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutes'
                        }
                    }
                }
            }
        });
    }
    
    // Calories chart
    const caloriesCtx = document.getElementById('caloriesChart');
    if (caloriesCtx) {
        const caloriesChart = new Chart(caloriesCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Calories Burned',
                    data: caloriesData,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.2
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Calories'
                        }
                    }
                }
            }
        });
    }
}

function getWeeklyChartData() {
    const labels = [];
    const workoutMinutesData = [0, 0, 0, 0, 0, 0, 0];
    const caloriesData = [0, 0, 0, 0, 0, 0, 0];

    // Generate labels for the last 7 days (e.g., 'Mon', 'Tue')
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    if (currentUser && workoutHistory && workoutHistory.length > 0) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const userWorkouts = workoutHistory.filter(wh => {
            return wh.userId === currentUser.id && new Date(wh.date) > sevenDaysAgo;
        });

        userWorkouts.forEach(entry => {
            const workout = getAllWorkouts().find(w => w.id == entry.workoutId);
            if (workout) {
                const entryDate = new Date(entry.date);
                const dayIndex = (entryDate.getDay() - (new Date().getDay() - 6) + 7) % 7;

                // Use a default duration if not specified (e.g., 20 mins for a set/rep workout)
                const duration = workout.duration || 20; 
                workoutMinutesData[dayIndex] += duration;
                caloriesData[dayIndex] += workout.calories;
            }
        });
    }

    return { labels, workoutMinutesData, caloriesData };
}

function initPerformanceCharts() {
    const performanceCtx = document.getElementById('performanceChart');
    if (performanceCtx) {
        const labels = workoutData.categories.map(cat => cat.name);
        const data = labels.map(label => {
            const category = workoutData.categories.find(c => c.name === label);
            const workoutIds = category.workouts.map(w => w.id);
            
            const categoryScores = workoutIds.map(id => calculatePerformanceScore(id));
            const avgScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
            return avgScore || 60; // Default score if no workouts logged
        });

        const performanceChart = new Chart(performanceCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Performance Score by Category',
                    data: data,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Score (%)'
                        }
                    }
                }
            }
        });
    }
}

function setupWorkoutLogging() {
    // Add event listeners for workout logging
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('log-workout')) {
            if (!currentUser) {
                showNotification('Please login to log workouts', 'error');
                loadPage('login');
                return;
            }
            
            const workoutId = e.target.getAttribute('data-id');
            if (await logWorkout(workoutId)) {
                e.target.textContent = 'Completed ✓';
                e.target.classList.remove('btn-primary');
                e.target.classList.add('btn-success');
                
                // Remove view performance button if it exists
                const viewPerformanceBtn = e.target.parentElement.querySelector('.view-performance');
                if (viewPerformanceBtn) {
                    viewPerformanceBtn.remove();
                }
            }
        }
        
        if (e.target.classList.contains('view-performance')) {
            if (!currentUser) {
                showNotification('Please login to view performance', 'error');
                loadPage('login');
                return;
            }
            
            const workoutId = e.target.getAttribute('data-id');
            const score = calculatePerformanceScore(workoutId);
            showNotification(`Your performance score for this workout: ${score}/100`, 'info');
        }
    });
}

function setupWorkoutCardHovers() {
    const workoutCards = document.querySelectorAll('.workout-card[data-workout-id]');
    let hoverInterval;

    workoutCards.forEach(card => {
        const workoutId = card.dataset.workoutId;
        const workout = getAllWorkouts().find(w => w.id == workoutId);
        const imgElement = document.getElementById(`workout-img-${workoutId}`);

        if (!workout || !imgElement || !workout.images || workout.images.length <= 1) {
            return; // Don't add hover effect if there's 1 or 0 images
        }

        let currentImageIndex = 0;

        card.addEventListener('mouseenter', () => {
            hoverInterval = setInterval(() => {
                currentImageIndex = (currentImageIndex + 1) % workout.images.length;
                imgElement.style.transition = 'opacity 0.5s ease-in-out';
                imgElement.style.opacity = 0;
                setTimeout(() => {
                    imgElement.src = workout.images[currentImageIndex];
                    imgElement.style.opacity = 1;
                }, 500);
            }, 1500); // Change image every 1.5 seconds
        });

        card.addEventListener('mouseleave', () => {
            clearInterval(hoverInterval);
            // Reset to the first image
            imgElement.src = workout.images[0];
            imgElement.style.opacity = 1;
            currentImageIndex = 0;
        });
    });
}

function setupWorkoutFilters() {
    const searchInput = document.getElementById('workout-search-input');
    const voiceBtn = document.getElementById('workout-search-voice-btn');
    const difficultyBtns = document.querySelectorAll('.difficulty-filter-btn');
    const clearBtn = document.getElementById('clear-filters-btn');
    
    const applyFilters = (isButtonClick = false) => {
        const searchTerm = searchInput.value.toLowerCase();
        let difficultyFilter = 'All';

        if (isButtonClick) {
            // If a button was clicked, update the active state
            difficultyBtns.forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline-primary');
            });
            event.target.classList.add('btn-primary');
            event.target.classList.remove('btn-outline-primary');
        }
        
        const activeDifficultyBtn = document.querySelector('.difficulty-filter-btn.btn-primary');
        difficultyFilter = activeDifficultyBtn ? activeDifficultyBtn.dataset.difficulty : 'All';

        let totalVisibleWorkouts = 0;
        const allWorkoutsData = getAllWorkouts();

        // Iterate over each category section
        document.querySelectorAll('.mb-5').forEach(categorySection => {
            let visibleInCategory = 0;
            // Iterate over each workout card within the category
            categorySection.querySelectorAll('.workout-card[data-workout-id]').forEach(card => {
                const workoutId = card.dataset.workoutId;
                const workout = allWorkoutsData.find(w => w.id == workoutId);
                const cardContainer = card.closest('.col-md-6');

                const matchesSearch = workout.name.toLowerCase().includes(searchTerm);
                const matchesDifficulty = difficultyFilter === 'All' || workout.difficulty === difficultyFilter;

                if (matchesSearch && matchesDifficulty) {
                    cardContainer.style.display = '';
                    visibleInCategory++;
                } else {
                    cardContainer.style.display = 'none';
                }
            });

            // Hide category title if no workouts in it are visible
            categorySection.style.display = visibleInCategory > 0 ? '' : 'none';
            totalVisibleWorkouts += visibleInCategory;
        });

        // Show or hide the "no results" message
        document.getElementById('no-workouts-found').style.display = totalVisibleWorkouts === 0 ? 'block' : 'none';
    };
    
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
            if (recognition && !isListening) {
                recognition.start();
                recognition.onresult = function(event) {
                    const command = event.results[0][0].transcript;
                    searchInput.value = command;
                    applyFilters();
                };
            } else if (!recognition) {
                showNotification('Speech recognition not available.', 'error');
            }
        });
    }

    difficultyBtns.forEach(btn => btn.addEventListener('click', () => applyFilters(true)));

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            document.querySelector('.difficulty-filter-btn[data-difficulty="All"]').click();
        });
    }
}

function initMacroChart() {
    const macroCtx = document.getElementById('macroChart');
    if (!macroCtx || !currentUser || !currentUser.savedDietPlan) return;

    const plan = currentUser.savedDietPlan;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;

    Object.values(plan.meals).forEach(meal => {
        if (meal) {
            totalProtein += meal.protein || 0;
            totalCarbs += meal.carbs || 0;
            totalFats += meal.fats || 0;
        }
    });

    new Chart(macroCtx, {
        type: 'doughnut',
        data: {
            labels: ['Protein (g)', 'Carbs (g)', 'Fats (g)'],
            datasets: [{
                label: 'Macronutrient Breakdown',
                data: [totalProtein, totalCarbs, totalFats],
                backgroundColor: [
                    'rgba(76, 201, 240, 0.7)', // Protein - Success
                    'rgba(255, 206, 86, 0.7)', // Carbs - Warning
                    'rgba(255, 99, 132, 0.7)'  // Fats - Danger
                ],
                borderColor: [
                    'rgba(76, 201, 240, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        }
    });
}

function setupRegisterForm() {
    const form = document.getElementById('registration-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const fitnessLevel = document.getElementById('fitness-level').value;
            const fitnessGoals = document.getElementById('fitness-goals').value;
            
            if (name && email && password) {
                await registerUser(name, email, password, fitnessLevel, fitnessGoals);
            } else {
                showNotification('Please fill all required fields', 'error');
            }
        });
    }
}

function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            await loginUser(email, password);
        });
    }
}

function setupDashboard() {
    // Set up progress circles
    document.querySelectorAll('.progress-circle').forEach(circle => {
        const progress = circle.getAttribute('data-progress');
        circle.style.setProperty('--progress', `${progress}%`);
    });

    // Dashboard chart
    const dashboardCtx = document.getElementById('dashboardChart');
    if (dashboardCtx) {
        const { labels, workoutMinutesData } = getWeeklyChartData();
        const dashboardChart = new Chart(dashboardCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Workout Minutes This Week',
                    data: workoutMinutesData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutes'
                        }
                    }
                }
            }
        });
    }

    // Initialize the new macro chart if a plan exists
    initMacroChart();
}

function setupNotifications() {
    const addNotificationBtn = document.getElementById('add-notification-btn');
    const notificationModal = new bootstrap.Modal(document.getElementById('notificationModal'));
    const notificationForm = document.getElementById('notification-form');

    if (addNotificationBtn) {
        addNotificationBtn.addEventListener('click', (e) => {
            notificationForm.reset();
            document.getElementById('notification-form').removeAttribute('data-editing-id');
            document.getElementById('notificationModalLabel').textContent = 'Set New Reminder';
            notificationModal.show();
        });
    }

    if (notificationForm) {
        notificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('notification-title').value;
            const message = document.getElementById('notification-message').value;
            const time = document.getElementById('notification-time').value;
            const type = document.getElementById('notification-type').value;
            const recurrence = document.getElementById('notification-recurrence').value;
            const editingId = notificationForm.getAttribute('data-editing-id');

            if (title && message && time) {
                if (editingId) {
                    // Update existing notification
                    try {
                        await db.collection('notifications').doc(editingId).update({
                            title, message, time, type, recurrence
                        });
                        // Update local cache
                        const notificationIndex = notifications.findIndex(n => n.id === editingId);
                        if (notificationIndex !== -1) {
                            notifications[notificationIndex] = { ...notifications[notificationIndex], title, message, time, type, recurrence };
                        }
                        showNotification('Reminder updated successfully!', 'success');
                    } catch (error) {
                        console.error("Error updating notification: ", error);
                        showNotification('Failed to update reminder.', 'error');
                    }
                } else {
                    // Create new notification
                    await scheduleNotification(title, message, time, type, recurrence);
                }
                // Re-render the page to show the changes
                loadPage('notifications');
                notificationModal.hide();
            } else {
                showNotification('Please fill all required fields.', 'error');
            }
        });
    }

    // Add event listeners for deleting and editing notifications
    document.addEventListener('click', async function(e) {
        const targetButton = e.target.closest('.delete-notification, .edit-notification');
        if (!targetButton) return;

        const notificationId = targetButton.getAttribute('data-id');

        if (targetButton.classList.contains('delete-notification')) {
            if (confirm('Are you sure you want to delete this reminder?')) {
                try {
                    await db.collection('notifications').doc(notificationId).delete();
                    notifications = notifications.filter(n => n.id !== notificationId);
                    targetButton.closest('.d-flex').remove();
                    showNotification('Reminder deleted', 'success');
                } catch (error) {
                    console.error("Error deleting notification: ", error);
                    showNotification('Failed to delete reminder.', 'error');
                }
            }
        } else if (targetButton.classList.contains('edit-notification')) {
            // This part remains the same as it just populates the modal form
            // The actual update happens in the form's submit handler
            const notificationToEdit = notifications.find(n => n.id === notificationId);
            if (notificationToEdit) {
                document.getElementById('notification-title').value = notificationToEdit.title;
                document.getElementById('notification-message').value = notificationToEdit.message;
                document.getElementById('notification-time').value = notificationToEdit.time;
                document.getElementById('notification-type').value = notificationToEdit.type;
                document.getElementById('notification-recurrence').value = notificationToEdit.recurrence;
                notificationForm.setAttribute('data-editing-id', notificationId);
                document.getElementById('notificationModalLabel').textContent = 'Edit Reminder';
                notificationModal.show();
            }
        }
    });
}

function setupAdaptiveWorkout() {
    let workoutTimerInterval = null;
    let timeRemaining = 0;

    // Update time value display
    const timeSlider = document.getElementById('time-available');
    const timeValue = document.getElementById('time-value');
    
    if (timeSlider && timeValue) {
        timeSlider.addEventListener('input', function() {
            timeValue.textContent = `${this.value} minutes`;
        });
    }
    
    // Set up energy level buttons
    document.querySelectorAll('.energy-level-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.energy-level-btn').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline-primary');
            });
            this.classList.remove('btn-outline-primary');
            this.classList.add('btn-primary');
        });
    });
    
    // Set up mood buttons
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mood-btn').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline-primary');
            });
            this.classList.remove('btn-outline-primary');
            this.classList.add('btn-primary');
        });
    });
    
    // Set up generate workout button
    const generateBtn = document.getElementById('generate-workout-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            const energyLevel = document.querySelector('.energy-level-btn.btn-primary')?.getAttribute('data-level') || 'medium';
            const mood = document.querySelector('.mood-btn.btn-primary')?.getAttribute('data-mood') || 'neutral';
            const focusArea = document.getElementById('focus-area').value;
            const timeAvailable = document.getElementById('time-available').value;
            
            const recommendation = generateAdaptiveWorkout(energyLevel, mood, timeAvailable, focusArea, 4);
            const workouts = recommendation.workouts;
            
            const workoutContainer = document.getElementById('recommended-workout');
            if (workoutContainer && workouts.length > 0) {                
                let workoutCardsHtml = workouts.map(workout => `
                    <div class="col-md-6 mb-4">
                        <div class="card workout-card h-100" data-bs-toggle="modal" data-bs-target="#exerciseDetailModal" data-id="${workout.id}" style="cursor: pointer;" data-loggable="false">
                            <img src="${workout.images[0]}" class="card-img-top workout-image" alt="${workout.name}">
                            <div class="card-body">
                                <h5 class="card-title">${workout.name}</h5>
                                <p class="card-text mb-1">Sets: ${workout.sets}, Reps: ${workout.reps}</p>
                                <p class="card-text">Difficulty: <span class="badge bg-${workout.difficulty === 'Beginner' ? 'success' : workout.difficulty === 'Intermediate' ? 'warning' : 'danger'}">${workout.difficulty}</span></p>
                            </div>
                        </div>
                    </div>
                `).join('');

                workoutContainer.innerHTML = `
                    <div id="workout-timer-container" class="workout-timer-container" style="display: none;">
                        <h4 id="timer-title">Workout in Progress</h4>
                        <div id="workout-timer-display" class="workout-timer-display">00:00</div>
                        <div class="d-flex justify-content-center">
                            <button class="btn btn-warning me-2" id="pause-resume-timer-btn">Pause</button>
                            <button class="btn btn-danger" id="finish-workout-btn">Finish Workout</button>
                        </div>
                    </div>
                    <h5 class="mb-3">Your Recommended ${timeAvailable}-Minute Plan:</h5>
                    <div class="row">${workoutCardsHtml}</div>
                    <button class="btn btn-success w-100" id="start-adaptive-workout-btn">
                        Start This Workout
                    </button>
                `;

                // --- Timer and Controls Logic ---
                document.getElementById('start-adaptive-workout-btn').addEventListener('click', () => {
                    document.getElementById('workout-timer-container').style.display = 'block';
                    document.getElementById('start-adaptive-workout-btn').style.display = 'none';
                    
                    timeRemaining = timeAvailable * 60;

                    const updateTimerDisplay = () => {
                        const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
                        const seconds = (timeRemaining % 60).toString().padStart(2, '0');
                        document.getElementById('workout-timer-display').textContent = `${minutes}:${seconds}`;
                    };

                    updateTimerDisplay();

                    workoutTimerInterval = setInterval(() => {
                        timeRemaining--;
                        updateTimerDisplay();
                        if (timeRemaining <= 0) {
                            clearInterval(workoutTimerInterval);
                            document.getElementById('timer-title').textContent = "Workout Complete!";
                            workouts.forEach(w => logWorkout(w.id));
                            showNotification("Great job! We've logged your adaptive workout.", "success");
                        }
                    }, 1000);
                });

                document.getElementById('pause-resume-timer-btn').addEventListener('click', function() {
                    if (workoutTimerInterval) {
                        clearInterval(workoutTimerInterval);
                        workoutTimerInterval = null;
                        this.textContent = 'Resume';
                        this.classList.replace('btn-warning', 'btn-info');
                    } else {
                        this.textContent = 'Pause';
                        this.classList.replace('btn-info', 'btn-warning');
                        // Restart the interval
                        document.getElementById('start-adaptive-workout-btn').click();
                        document.getElementById('start-adaptive-workout-btn').style.display = 'none'; // re-hide it
                    }
                });

                document.getElementById('finish-workout-btn').addEventListener('click', () => {
                    clearInterval(workoutTimerInterval);
                    document.getElementById('timer-title').textContent = "Workout Finished!";
                    document.getElementById('pause-resume-timer-btn').disabled = true;
                    document.getElementById('finish-workout-btn').disabled = true;
                    workouts.forEach(w => logWorkout(w.id));
                    showNotification("Workout logged successfully!", "success");
                });
            }
        });
    }
}

function setupDietPlanPage() {
    const form = document.getElementById('diet-plan-form');
    const step1 = document.getElementById('diet-step-1');
    const step2 = document.getElementById('diet-step-2');
    const nextBtn = document.getElementById('diet-next-1');
    const backBtn = document.getElementById('diet-back-2');
    const resultContainer = document.getElementById('diet-result-container');

    // --- Pre-populate form with saved user data ---
    if (currentUser) {
        if (currentUser.gender) document.getElementById('diet-gender').value = currentUser.gender;
        if (currentUser.age) document.getElementById('diet-age').value = currentUser.age;
        if (currentUser.weight) document.getElementById('diet-weight').value = currentUser.weight;
        if (currentUser.height) document.getElementById('diet-height').value = currentUser.height;
        if (currentUser.activity) document.getElementById('diet-activity').value = currentUser.activity;
    }
    // --- End pre-population ---

    // --- Reset and Initialize Diet Plan State ---
    dietPlanState = {
        params: {},
        plan: { meals: {} }, // Always initialize with a meals object
        wholePlanRegenCount: 10,
        singleMealRegenCounts: { breakfast: 10, lunch: 10, dinner: 10 }
    };

    const planRegenCountEl = document.getElementById('plan-regen-count');
    if (planRegenCountEl) {
        planRegenCountEl.textContent = dietPlanState.wholePlanRegenCount;
    }

    if (!nextBtn || !backBtn || !form) return;

    nextBtn.addEventListener('click', () => {
        // This part remains the same
        const goal = document.getElementById('diet-goal').value;
        const preference = document.getElementById('diet-preference').value;
        if (goal && preference) {
            step1.style.display = 'none';
            step2.style.display = 'block';
        } else {
            showNotification('Please select your goal and preference.', 'error');
        }
    });

    backBtn.addEventListener('click', () => {
        step2.style.display = 'none';
        step1.style.display = 'block';
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // --- Regeneration Limit Check ---
        if (dietPlanState.wholePlanRegenCount <= 0) {
            showNotification('You have reached the limit for generating new plans.', 'error');
            return;
        }
        dietPlanState.wholePlanRegenCount--;
        if(planRegenCountEl) planRegenCountEl.textContent = dietPlanState.wholePlanRegenCount;
        // --- End Check ---

        const goal = document.getElementById('diet-goal').value;
        const preference = document.getElementById('diet-preference').value;
        const ingredient = document.getElementById('ingredient-search').value.trim();
        const gender = document.getElementById('diet-gender').value;
        const age = parseInt(document.getElementById('diet-age').value);
        const weight = parseFloat(document.getElementById('diet-weight').value);
        const height = parseFloat(document.getElementById('diet-height').value);
        const activity = parseFloat(document.getElementById('diet-activity').value);

        if (!age || !weight || !height) {
            showNotification('Please fill in all your details.', 'error');
            return;
        }

        // --- Save user biometrics to Firestore ---
        const userBiometrics = { gender, age, weight, height, activity };
        saveUserBiometrics(userBiometrics);
        showNotification('Your details have been saved to your profile.', 'info');
        // --- End save ---

        const maintenanceCalories = calculateMaintenanceCalories(gender, weight, height, age, activity);
        
        let targetCalories;
        if (goal === 'cutting') {
            targetCalories = maintenanceCalories - 500;
        } else { // bulking or other
            targetCalories = maintenanceCalories + 500;
        }

        dietPlanState.params = { // Store current parameters for single meal regeneration
            preference,
            ingredient,
            targetCalories: Math.round(targetCalories)
        };

        // Reset single meal counts whenever a new plan is generated
        dietPlanState.singleMealRegenCounts = { breakfast: 10, lunch: 10, dinner: 10 };

        const plan = generateDietPlan(preference, targetCalories, ingredient);
        dietPlanState.plan = plan; // Store the generated plan in the state
        resultContainer.innerHTML = renderDietResult({
            ...plan,
            goal: goal,
            targetCalories: Math.round(targetCalories)
        });
        resultContainer.style.display = 'block';
        resultContainer.scrollIntoView({ behavior: 'smooth' });

        // Initialize count display for regenerate buttons
        document.querySelectorAll('.regenerate-meal-btn').forEach(btn => {
            const countEl = btn.querySelector('span');
            if (countEl) {
                countEl.textContent = singleMealRegenCounts[btn.dataset.mealType];
            }
        });
    });
}

function calculateMaintenanceCalories(gender, weight, height, age, activityMultiplier) {
    let bmr;
    // Mifflin-St Jeor Equation
    if (gender === 'male') {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else { // female
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
    return Math.round(bmr * activityMultiplier);
}

/**
 * Saves user's biometric data to their Firestore profile.
 * @param {object} biometrics - The user's biometric data.
 */
async function saveUserBiometrics(biometrics) {
    if (!currentUser || !firebaseUser) return;

    try {
        await db.collection('users').doc(firebaseUser.uid).update(biometrics);
        // Update local currentUser object as well
        currentUser = { ...currentUser, ...biometrics };
    } catch (error) {
        console.error("Error saving user biometrics: ", error);
    }
}

function generateDietPlan(preference, targetCalories, ingredient = '') {
    const meals = {};
    let totalCalories = 0;

    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    const calorieDistribution = {
        breakfast: 0.30,
        lunch: 0.40,
        dinner: 0.30
    };

    mealTypes.forEach(mealType => {
        const chosenMeal = getNewMeal(mealType, preference, Object.values(meals).filter(Boolean).map(m => m.id), ingredient, calorieDistribution[mealType] * targetCalories);
        if (chosenMeal) {
            meals[mealType] = chosenMeal;
            totalCalories += chosenMeal.calories;
        }
    });

    return { meals, totalCalories };
}

async function saveDietPlan(plan) {
    if (!currentUser || !firebaseUser || !plan) return;

    try {
        await db.collection('users').doc(firebaseUser.uid).update({ savedDietPlan: plan });
        currentUser.savedDietPlan = plan; // Update local state
        showNotification('Diet plan saved to your profile!', 'success');
    } catch (error) {
        console.error("Error saving diet plan: ", error);
        showNotification('Could not save diet plan.', 'error');
    }
}

function getNewMeal(mealType, preference, existingMealIds = [], ingredient = '', mealTargetCalories) {
    let potentialMeals = [...dietData[mealType]]; // Create a mutable copy

    // Map form values to data values
    if (preference === 'Veg') {
        potentialMeals = potentialMeals.filter(meal => meal.preference === 'Vegetarian' || meal.preference === 'Vegan');
    } else if (preference === 'Non-Veg') {
        potentialMeals = potentialMeals.filter(meal => meal.preference === 'Non-Vegetarian');
    } else if (preference === 'Vegan') {
        potentialMeals = potentialMeals.filter(meal => meal.preference === 'Vegan');
    } else if (preference !== 'All') {
        // Fallback for any other preference value, though the above should cover it
        potentialMeals = potentialMeals.filter(meal => meal.preference === preference);
    }

    // Filter by ingredient if one is provided
    if (ingredient) {
        potentialMeals = potentialMeals.filter(meal => meal.ingredients.toLowerCase().includes(ingredient.toLowerCase()));
    }

    // Filter out meals that are already in the plan
    potentialMeals = potentialMeals.filter(meal => !existingMealIds.includes(meal.id));

    // If no meals are left after all filters, return null to prevent errors
    if (potentialMeals.length === 0) {
        console.warn(`No suitable meals found for ${mealType} with preference ${preference} and ingredient "${ingredient}".`);
        // If no meals are available after filtering, return null.
        return null;
    }

    // Sort meals by how close they are to the target calorie count
    potentialMeals.sort((a, b) => {
        const diffA = Math.abs(a.calories - mealTargetCalories);
        const diffB = Math.abs(b.calories - mealTargetCalories);
        return diffA - diffB;
    });

    // Take the top 5 closest meals to add some variety
    const top5Closest = potentialMeals.slice(0, 5);

    // Pick a random meal from this top 5 pool
    const chosenMeal = top5Closest[Math.floor(Math.random() * top5Closest.length)];

    return chosenMeal;
}

function regenerateSingleMeal(mealTypeToRegenerate, buttonElement) {
    const { plan, params } = dietPlanState;

    // Get IDs of all meals *except* the one we are regenerating
    const existingMealIds = Object.keys(plan.meals)
        .filter(mealType => mealType !== mealTypeToRegenerate)
        .map(mealType => plan.meals[mealType]?.id).filter(Boolean);
    
    const newMeal = getNewMeal(mealTypeToRegenerate, params.preference, existingMealIds, params.ingredient, params.targetCalories * 0.3); // Assuming ~30% calories for the meal
    
    if (newMeal) {
        // Update the global state directly
        dietPlanState.plan.meals[mealTypeToRegenerate] = newMeal;

        const mealCardContainer = document.querySelector(`.meal-card-container[data-meal-type="${mealTypeToRegenerate}"]`);
        mealCardContainer.outerHTML = renderMealCard(newMeal, mealTypeToRegenerate);
        
        const newButton = document.querySelector(`.regenerate-meal-btn[data-meal-type="${mealTypeToRegenerate}"]`);
        const newCountEl = newButton.querySelector('span');
        
        // Update the count on the new button
        if (newCountEl && dietPlanState.singleMealRegenCounts) {
            newCountEl.textContent = dietPlanState.singleMealRegenCounts[mealTypeToRegenerate];
        }

        // Re-enable the save button since the plan has changed
        const saveBtn = document.getElementById('save-diet-plan-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save This Plan';
        }

    }
}

function renderDietResult(plan) {
    let mealCards = '';
    ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
        const meal = plan.meals[mealType];
        if (meal) {
            mealCards += renderMealCard(meal, mealType);
        }
    });

    return `
        <h2 class="mb-3">Your Custom Diet Plan</h2>
        <div class="alert alert-success">Your estimated <strong>${plan.goal}</strong> target is <strong>${plan.targetCalories} calories</strong> per day. This plan provides approximately <strong>${plan.totalCalories} calories</strong>.</div>
        <div class="row">${mealCards}</div>
        <div class="d-grid gap-2 mt-4">
            <button class="btn btn-lg btn-success" id="save-diet-plan-btn">
                <i class="fas fa-save me-2"></i>Save This Plan
            </button>
        </div>
    `;
}

function setupExerciseModal() {
    const exerciseModal = document.getElementById('exerciseDetailModal');
    if (!exerciseModal) return;

    exerciseModal.addEventListener('show.bs.modal', function(event) {
        const card = event.relatedTarget;
        const isLoggable = card.getAttribute('data-loggable') === 'true';
        const exerciseId = card.getAttribute('data-id');
        const details = exerciseDetails[exerciseId];

        if (!details) {
            console.error('Exercise details not found for ID:', exerciseId);
            // Optionally hide the modal or show an error
            return;
        }

        // Handle Log Workout button in modal
        const modalLogBtn = document.getElementById('modal-log-workout-btn');
        const exerciseModalInstance = bootstrap.Modal.getInstance(exerciseModal);

        if (isLoggable && currentUser) {
            modalLogBtn.style.display = 'block';
            modalLogBtn.onclick = async () => {
                if (await logWorkout(exerciseId)) {
                    renderWorkoutsPage(); // Re-render to show completion status on card
                }
                exerciseModalInstance.hide();
            };
        } else {
            modalLogBtn.style.display = 'none';
        }

        // Handle AI Coach button
        const aiCoachBtn = document.getElementById('modal-ai-coach-btn');
        aiCoachBtn.onclick = () => {
            currentExerciseIdForCoach = exerciseId;
            initAICoach(true); // Pass true to show the container
        };

        // Populate text content
        document.getElementById('modal-exercise-name').textContent = details.name;
        document.getElementById('modal-exercise-description').textContent = details.description;
        document.getElementById('modal-target-muscles').textContent = details.targetMuscles.join(', ');
        document.getElementById('modal-equipment').textContent = details.equipment.join(', ');
        document.getElementById('modal-difficulty').innerHTML = `<span class="badge bg-${details.difficulty === 'Beginner' ? 'success' : details.difficulty === 'Intermediate' ? 'warning' : 'danger'}">${details.difficulty}</span>`;

        // Populate lists
        const populateList = (elementId, items) => {
            const list = document.getElementById(elementId);
            list.innerHTML = '';
            items.forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = item;
                list.appendChild(li);
            });
        };

        populateList('modal-exercise-steps', details.steps);
        populateList('modal-exercise-tips', details.tips);
        populateList('modal-exercise-precautions', details.precautions);

        // Populate image gallery
        const gallery = document.getElementById('exercise-image-gallery');
        gallery.innerHTML = ''; // Clear previous images
        const workout = getAllWorkouts().find(w => w.id == exerciseId);
        const imagePaths = workout ? workout.images : [];

        if (!imagePaths || imagePaths.length === 0) {
            gallery.innerHTML = '<p class="text-muted">No images available for this exercise.</p>';
            return;
        }

        imagePaths.forEach(path => {
            const img = document.createElement('img');
            img.src = path;
            img.alt = `${details.name} image`;
            img.onerror = () => { img.style.display = 'none'; }; // Hide if image fails to load

            // Add click listener for lightbox
            img.addEventListener('click', () => {
                const lightboxImage = document.getElementById('lightbox-image');
                lightboxImage.src = path;
                const lightboxModal = new bootstrap.Modal(document.getElementById('imageLightboxModal'));
                lightboxModal.show();
            });

            gallery.appendChild(img);
        });
    });
}

function getAngle(p1, p2, p3) {
    const a = Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
    const b = Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2);
    const c = Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2);
    return (Math.acos((a + b - c) / Math.sqrt(4 * a * b)) * 180) / Math.PI;
}

function speak(text, force = false) {
    if ('speechSynthesis' in window) {
        if (text === lastSpokenFeedback && !force) return;

        window.speechSynthesis.cancel(); // Stop any previous speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
        lastSpokenFeedback = text;
    }
}

async function initAICoach(showContainer = false) {
    const coachContainer = document.getElementById('aiCoachContainer');
    const statusElement = document.getElementById('ai-coach-status');
    const feedbackElement = document.getElementById('ai-feedback');

    if (showContainer) {
        coachContainer.style.display = 'block';
    }

    try {
        statusElement.textContent = 'Loading AI model...'; speak(statusElement.textContent, true);
        statusElement.style.display = 'block';
        feedbackElement.style.display = 'none';

        const model = poseDetection.SupportedModels.MoveNet;
        poseDetector = await poseDetection.createDetector(model);
        statusElement.textContent = 'Accessing camera...';

        webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = webcamStream;

        videoElement.onloadedmetadata = () => {
            videoElement.play();
            // Use a small timeout to ensure video dimensions are ready
            setTimeout(() => {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                statusElement.style.display = 'none';
                feedbackElement.style.display = 'block';
                detectPose();
            }, 100);
        };

    } catch (error) {
        console.error("AI Coach initialization failed:", error);
        statusElement.textContent = 'Failed to start AI Coach. Please ensure you have a webcam and have granted camera permissions.'; speak(statusElement.textContent, true);
        statusElement.classList.add('text-danger');
    }
}

function setupAICoachWindow() {
    const coachContainer = document.getElementById('aiCoachContainer');
    const coachHeader = document.getElementById('aiCoachHeader');
    const closeBtn = document.getElementById('close-ai-coach-btn');
    const toggleBtn = document.getElementById('toggle-size-btn');
    const resizeHandle = document.getElementById('resize-handle');

    let isDragging = false;
    let offsetX, offsetY;

    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    // To store the state before maximizing
    let previousWindowState = {};

    if (!coachContainer || !coachHeader || !closeBtn || !toggleBtn || !resizeHandle) {
        console.error("One or more AI Coach window elements are missing.");
        return;
    }

    const stopAICoach = () => {
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        coachContainer.style.display = 'none';
        lastSpokenFeedback = ""; // Reset spoken feedback
        repCounter = 0; // Reset rep counter
        exerciseState = 'up'; // Reset exercise state
        window.speechSynthesis.cancel(); // Ensure speech stops when modal closes
    };

    coachHeader.addEventListener('mousedown', (e) => {
        // Prevent dragging when clicking on buttons inside the header
        if (e.target.closest('button')) return;
        isDragging = true;
        offsetX = e.clientX - coachContainer.offsetLeft;
        offsetY = e.clientY - coachContainer.offsetTop;
        // Remove bottom/right positioning when dragging starts
        coachContainer.style.right = 'auto';
        coachContainer.style.bottom = 'auto';

        coachContainer.style.transition = 'none'; // Disable transition while dragging
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        coachContainer.style.left = `${e.clientX - offsetX}px`;
        coachContainer.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        coachContainer.style.transition = 'all 0.3s ease-in-out'; // Re-enable transition
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(coachContainer).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(coachContainer).height, 10);
        coachContainer.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = startWidth + e.clientX - startX;
        const newHeight = startHeight + e.clientY - startY;
        coachContainer.style.width = `${newWidth}px`;
        coachContainer.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        coachContainer.style.transition = 'all 0.3s ease-in-out';
    });

    closeBtn.addEventListener('click', stopAICoach);

    toggleBtn.addEventListener('click', () => {
        coachContainer.classList.toggle('maximized');
        const icon = toggleBtn.firstElementChild;

        if (coachContainer.classList.contains('maximized')) {
            // Save current state before maximizing
            const rect = coachContainer.getBoundingClientRect();
            previousWindowState = {
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                top: `${rect.top}px`,
                left: `${rect.left}px`,
            };

            // Maximize
            icon.classList.remove('fa-expand-alt');
            icon.classList.add('fa-compress-alt');
            toggleBtn.title = "Restore";
            resizeHandle.style.display = 'none'; // Hide resize handle when maximized
        } else {
            // Restore to previous state
            coachContainer.style.width = previousWindowState.width;
            coachContainer.style.height = previousWindowState.height;
            coachContainer.style.top = previousWindowState.top;
            coachContainer.style.left = previousWindowState.left;
            // Clear right/bottom to ensure left/top positioning takes precedence
            coachContainer.style.right = 'auto';
            coachContainer.style.bottom = 'auto';

            icon.classList.remove('fa-compress-alt');
            icon.classList.add('fa-expand-alt');
            toggleBtn.title = "Maximize";
            resizeHandle.style.display = 'block'; // Show resize handle again
        }
    });
}

function checkSquatForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    // Check if essential keypoints are visible
    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle', 'right_shoulder', 'right_hip', 'right_knee', 'right_ankle'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) {
            return "Please make sure your full body is visible to the camera.";
        }
    }

    // Calculate angles for knees and back
    const leftKneeAngle = getAngle(keypoints.left_hip, keypoints.left_knee, keypoints.left_ankle);
    const rightKneeAngle = getAngle(keypoints.right_hip, keypoints.right_knee, keypoints.right_ankle);
    const leftHipAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_knee);
    const rightHipAngle = getAngle(keypoints.right_shoulder, keypoints.right_hip, keypoints.right_knee);

    // Logic for squat state and rep counting
    if ((leftKneeAngle < 100 || rightKneeAngle < 100) && exerciseState === 'up') {
        exerciseState = 'down';
        // Check for back posture at the bottom of the squat
        if (leftHipAngle < 80 || rightHipAngle < 80) {
            return "Keep your chest up and back straight.";
        } else {
            return "Good depth, now drive up!";
        }
    } else if ((leftKneeAngle > 160 && rightKneeAngle > 160) && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete! Great job.`;
    } else if (exerciseState === 'up' && (leftKneeAngle < 160 || rightKneeAngle < 160)) {
        // Feedback for starting the descent
        return "Lower your hips until your thighs are parallel to the ground.";
    } else if (exerciseState === 'down') {
        // Persistent feedback if form is incorrect in the 'down' state
        if (leftHipAngle < 80 || rightHipAngle < 80) {
            return "Straighten your back and keep your chest up.";
        }
    } else {
        return `Reps: ${repCounter}. Ready for next rep.`;
        }
}

function checkPushUpForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_ankle', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) {
            return "Please make sure your full body is visible to the camera.";
        }
    }

    const leftElbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);
    const leftBodyAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_ankle);

    // Check for straight body
    if (leftBodyAngle < 160) {
        return "Keep your body straight. Don't let your hips sag.";
    }

    // Rep counting logic
    if (leftElbowAngle < 90 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Good depth. Push up!";
    } else if (leftElbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    } else if (exerciseState === 'up' && leftElbowAngle < 160) {
        return "Lower your chest towards the floor.";
    } else {
        return `Reps: ${repCounter}. Ready for next rep.`;
    }
}

function checkBicepCurlForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) {
            return "Please make sure your arm is visible.";
        }
    }

    const leftElbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);

    // Rep counting logic
    if (leftElbowAngle < 70 && exerciseState === 'up') { // 'up' state means arm is down
        exerciseState = 'down'; // 'down' state means arm is curled up
        return "Good curl. Lower with control.";
    } else if (leftElbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    } else {
        return `Reps: ${repCounter}. Ready for next rep.`;
    }
}

function checkPlankForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_ankle'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Position your full body in the frame.";
    }

    const bodyAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_ankle);

    if (bodyAngle < 165) return "Keep your back straight. Don't let your hips sag.";
    if (bodyAngle > 190) return "Lower your hips to form a straight line.";

    return "Holding strong! Keep your core tight.";
}

function checkRowForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_knee', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Please position your side profile to the camera.";
    }

    const hipAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_knee);
    const elbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);

    if (hipAngle < 100) {
        return "Keep your back straight. Don't round your lower back.";
    }

    if (elbowAngle < 90 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Squeeze your back. Lower with control.";
    } else if (elbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    }
    return `Reps: ${repCounter}. Ready for next rep.`;
}

function checkOverheadPressForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Please face the camera.";
    }

    const elbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);

    if (elbowAngle < 100 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Press up!";
    } else if (elbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    }
    return `Reps: ${repCounter}. Ready for next rep.`;
}

function checkLateralRaiseForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_elbow', 'left_hip'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Please face the camera.";
    }

    const shoulderAngle = getAngle(keypoints.left_elbow, keypoints.left_shoulder, keypoints.left_hip);

    if (shoulderAngle > 100) {
        return "Don't raise your arms above shoulder height.";
    }

    if (shoulderAngle > 80 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Good. Lower with control.";
    } else if (shoulderAngle < 45 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    }
    return `Reps: ${repCounter}. Ready for next rep.`;
}

function checkDeadliftForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_knee'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Side profile needed. Ensure full body is visible.";
    }

    const hipAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_knee);

    if (hipAngle < 150 && exerciseState === 'up') {
        return "Keep your back straight as you lift.";
    }
    return "Focus on maintaining a neutral spine.";
}

// Placeholder for missing function to prevent errors
function checkLatPulldownForm(pose) {
    return "Form analysis for Lat Pulldown is coming soon!";
}

// Placeholder for missing function to prevent errors
function checkTricepDipForm(pose) {
    return "Form analysis for Tricep Dips is coming soon!";
}

function checkLegRaiseForm(pose) {
    // This is a simplified check
    return "Keep your lower back on the floor and legs straight.";
}

function drawPose(pose, ctx) {
    const keypoints = pose.keypoints;
    
    // Draw keypoints
    keypoints.forEach(keypoint => {
        if (keypoint.score > 0.5) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#4cc9f0'; // success color
            ctx.fill();
        }
    });

    // Draw skeleton
    const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    adjacentKeyPoints.forEach((pair) => {
        const [i, j] = pair;
        if (keypoints[i].score > 0.5 && keypoints[j].score > 0.5) {
            ctx.beginPath();
            ctx.moveTo(keypoints[i].x, keypoints[i].y);
            ctx.lineTo(keypoints[j].x, keypoints[j].y);
            ctx.strokeStyle = '#4361ee'; // primary color
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

// Utility Functions
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="me-2">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            </div>
            <div>${message}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

const formCheckers = {
    '105': checkPushUpForm, // Push Up
    '201': checkLatPulldownForm, // Lat Pulldown
    '203': checkRowForm, // T Bar Row
    '301': checkSquatForm, // Squat
    '302': checkDeadliftForm, // Deadlift
    '304': checkLegRaiseForm, // Leg Raises
    '401': checkOverheadPressForm, // Shoulder Press
    '402': checkLateralRaiseForm, // Lateral Raises
    '501': checkBicepCurlForm, // Barbell Biceps Curl
    '503': checkTricepDipForm, // Tricep Dips
    '601': checkPlankForm, // Plank
};

async function detectPose() {
    if (poseDetector && videoElement.readyState >= 2) {
        const poses = await poseDetector.estimatePoses(videoElement, {
            flipHorizontal: false
        });

        const ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (poses.length > 0) {
            const pose = poses[0];
            drawPose(pose, ctx);

            const checkerFunction = formCheckers[currentExerciseIdForCoach];
            const currentFeedback = checkerFunction ? checkerFunction(pose) : "Form analysis for this exercise is not yet available.";

            document.getElementById('ai-feedback').textContent = currentFeedback;
            speak(currentFeedback);
        } else {
            let currentFeedback = "No person detected. Please position yourself in front of the camera.";
            document.getElementById('ai-feedback').textContent = currentFeedback;
            speak(currentFeedback);
        }
    }
    animationFrameId = requestAnimationFrame(detectPose);
}

function checkSquatForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    // Check if essential keypoints are visible
    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle', 'right_shoulder', 'right_hip', 'right_knee', 'right_ankle'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) {
            return "Please make sure your full body is visible to the camera.";
        }
    }

    // Calculate angles for knees and back
    const leftKneeAngle = getAngle(keypoints.left_hip, keypoints.left_knee, keypoints.left_ankle);
    const rightKneeAngle = getAngle(keypoints.right_hip, keypoints.right_knee, keypoints.right_ankle);
    const leftHipAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_knee);
    const rightHipAngle = getAngle(keypoints.right_shoulder, keypoints.right_hip, keypoints.right_knee);

    // Logic for squat state and rep counting
    if ((leftKneeAngle < 100 || rightKneeAngle < 100) && exerciseState === 'up') {
        exerciseState = 'down';
        // Check for back posture at the bottom of the squat
        if (leftHipAngle < 80 || rightHipAngle < 80) {
            return "Keep your chest up and back straight.";
        } else {
            return "Good depth, now drive up!";
        }
    } else if ((leftKneeAngle > 160 && rightKneeAngle > 160) && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete! Great job.`;
    } else if (exerciseState === 'up' && (leftKneeAngle < 160 || rightKneeAngle < 160)) {
        // Feedback for starting the descent
        return "Lower your hips until your thighs are parallel to the ground.";
    } else if (exerciseState === 'down') {
        // Persistent feedback if form is incorrect in the 'down' state
        if (leftHipAngle < 80 || rightHipAngle < 80) {
            return "Straighten your back and keep your chest up.";
        }
    } else {
        return `Reps: ${repCounter}. Ready for next rep.`;
        }
}

function checkPushUpForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_ankle', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) {
            return "Please make sure your full body is visible to the camera.";
        }
    }

    const leftElbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);
    const leftBodyAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_ankle);

    // Check for straight body
    if (leftBodyAngle < 160) {
        return "Keep your body straight. Don't let your hips sag.";
    }

    // Rep counting logic
    if (leftElbowAngle < 90 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Good depth. Push up!";
    } else if (leftElbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    } else if (exerciseState === 'up' && leftElbowAngle < 160) {
        return "Lower your chest towards the floor.";
    } else {
        return `Reps: ${repCounter}. Ready for next rep.`;
    }
}

function checkLatPulldownForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.5) {
            return "Please face the camera and ensure your upper body is visible.";
        }
    }

    const leftElbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);

    if (keypoints.left_elbow.y > keypoints.left_shoulder.y && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    } else if (keypoints.left_elbow.y < keypoints.left_shoulder.y && exerciseState === 'up') {
        exerciseState = 'down';
        return "Pull down to your chest.";
    }
    return `Reps: ${repCounter}. Ready for next rep.`;
}

function checkBicepCurlForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) {
            return "Please make sure your arm is visible.";
        }
    }

    const leftElbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);

    // Rep counting logic
    if (leftElbowAngle < 70 && exerciseState === 'up') { // 'up' state means arm is down
        exerciseState = 'down'; // 'down' state means arm is curled up
        return "Good curl. Lower with control.";
    } else if (leftElbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    } else {
        return `Reps: ${repCounter}. Ready for next rep.`;
    }
}

function checkPlankForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_ankle'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Position your full body in the frame.";
    }

    const bodyAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_ankle);

    if (bodyAngle < 165) return "Keep your back straight. Don't let your hips sag.";
    if (bodyAngle > 190) return "Lower your hips to form a straight line.";

    return "Holding strong! Keep your core tight.";
}

function checkRowForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_knee', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Please position your side profile to the camera.";
    }

    const hipAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_knee);
    const elbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);

    if (hipAngle < 100) {
        return "Keep your back straight. Don't round your lower back.";
    }

    if (elbowAngle < 90 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Squeeze your back. Lower with control.";
    } else if (elbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    }
    return `Reps: ${repCounter}. Ready for next rep.`;
}

function checkOverheadPressForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Please face the camera.";
    }

    const elbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);

    if (elbowAngle < 100 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Press up!";
    } else if (elbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    }
    return `Reps: ${repCounter}. Ready for next rep.`;
}

function checkLateralRaiseForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_elbow', 'left_hip'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Please face the camera.";
    }

    const shoulderAngle = getAngle(keypoints.left_elbow, keypoints.left_shoulder, keypoints.left_hip);

    if (shoulderAngle > 100) {
        return "Don't raise your arms above shoulder height.";
    }

    if (shoulderAngle > 80 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Good. Lower with control.";
    } else if (shoulderAngle < 45 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    }
    return `Reps: ${repCounter}. Ready for next rep.`;
}

function checkTricepDipForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_elbow', 'left_wrist'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) {
            return "Please position your side profile to the camera.";
        }
    }

    const elbowAngle = getAngle(keypoints.left_shoulder, keypoints.left_elbow, keypoints.left_wrist);

    if (elbowAngle < 100 && exerciseState === 'up') {
        exerciseState = 'down';
        return "Good depth. Push back up.";
    } else if (elbowAngle > 160 && exerciseState === 'down') {
        exerciseState = 'up';
        repCounter++;
        return `Rep ${repCounter} complete!`;
    }
    return `Reps: ${repCounter}. Ready for next rep.`;
}

function checkDeadliftForm(pose) {
    const keypoints = pose.keypoints.reduce((acc, keypoint) => {
        acc[keypoint.name] = keypoint;
        return acc;
    }, {});

    const requiredKeypoints = ['left_shoulder', 'left_hip', 'left_knee'];
    for (const kp of requiredKeypoints) {
        if (!keypoints[kp] || keypoints[kp].score < 0.6) return "Side profile needed. Ensure full body is visible.";
    }

    const hipAngle = getAngle(keypoints.left_shoulder, keypoints.left_hip, keypoints.left_knee);

    if (hipAngle < 150 && exerciseState === 'up') {
        return "Keep your back straight as you lift.";
    }
    return "Focus on maintaining a neutral spine.";
}

function checkLegRaiseForm(pose) {
    // This is a simplified check
    return "Keep your lower back on the floor and legs straight.";
}

function drawPose(pose, ctx) {
    const keypoints = pose.keypoints;
    
    // Draw keypoints
    keypoints.forEach(keypoint => {
        if (keypoint.score > 0.5) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#4cc9f0'; // success color
            ctx.fill();
        }
    });

    // Draw skeleton
    const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    adjacentKeyPoints.forEach((pair) => {
        const [i, j] = pair;
        if (keypoints[i].score > 0.5 && keypoints[j].score > 0.5) {
            ctx.beginPath();
            ctx.moveTo(keypoints[i].x, keypoints[i].y);
            ctx.lineTo(keypoints[j].x, keypoints[j].y);
            ctx.strokeStyle = '#4361ee'; // primary color
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

// Check for scheduled notifications every minute
setInterval(checkScheduledNotifications, 30000); // Check every 30 seconds for more accuracy

async function initializeApp() {
    try {
        const appDataUrl = 'app_data.json';
        const recipeDataUrl = 'full_recipe_data.json';

        const responses = await Promise.all([
            fetch(appDataUrl).catch(e => { throw new Error(`Failed to fetch ${appDataUrl}: ${e.message}`) }),
            fetch(recipeDataUrl).catch(e => { throw new Error(`Failed to fetch ${recipeDataUrl}: ${e.message}`) })
        ]);

        // Check if any response is not ok
        for (const response of responses) {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} for ${response.url}`);
            }
        }

        const [appData, recipeData] = await Promise.all(responses.map(res => res.json()));
        
        // Assign fetched data to global variables
        workoutData = appData.workoutData;
        exerciseDetails = appData.exerciseDetails;
        achievementsData = appData.achievementsData;
        // Diet data now comes from its own file
        dietData = recipeData;

        // Now that data is loaded, we can initialize the rest of the app
        loadPage('home');
        
        // Set up navigation
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', async function(e) {
                e.preventDefault();
                const page = this.getAttribute('data-page');
                if (page === 'logout') {
                    await logout();
                } else {
                    loadPage(page);
                }
            });
        });
        
        updateNavigation();
        // setupExerciseModal(); // This is now called inside initializeApp
        checkScheduledNotifications();

    } catch (error) {
        console.error("Could not load application data:", error);
        document.getElementById('app-content').innerHTML = `<div class="alert alert-danger">Failed to load application data. Please try refreshing the page.</div>`;
    }
}

// Initialize the application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();

    // Use event delegation for regenerate buttons since they are created dynamically
    document.getElementById('app-content').addEventListener('click', function(e) {
        const regenerateBtn = e.target.closest('.regenerate-meal-btn');
        if (regenerateBtn) {
            e.preventDefault(); // Prevent any default button behavior
            const mealType = regenerateBtn.dataset.mealType;

            // Add a guard to ensure a plan has been generated first
            if (!dietPlanState.plan || !dietPlanState.plan.meals || Object.keys(dietPlanState.plan.meals).length === 0) {
                showNotification('Please generate a full diet plan first.', 'error');
                return;
            }
            if (dietPlanState.singleMealRegenCounts[mealType] > 0) {
                dietPlanState.singleMealRegenCounts[mealType]--;
                regenerateSingleMeal(mealType, regenerateBtn);
            } else {
                showNotification(`You have reached the regeneration limit for ${mealType}.`, 'error');
            }
        }
    });

    setupExerciseModal();
    setupAICoachWindow();
});