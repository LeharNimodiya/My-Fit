// UI Rendering Functions

function renderHomePage() {
    return `
        <div class="hero-section">
            <h1 class="display-4">Welcome to MyFist</h1>
            <p class="lead">Your personal fitness companion for achieving your health goals</p>
            ${!currentUser ? '<a href="#" class="btn btn-primary btn-lg mt-3" data-page="register">Get Started</a>' : ''}
        </div>
        
        <h2 class="text-center mb-5">All-in-One Fitness Solution</h2>
        
        <div class="row">
            <div class="col-md-4 mb-4">
                <div class="card h-100 text-center">
                    <div class="card-body">
                        <div class="feature-icon">
                            <i class="fas fa-running"></i>
                        </div>
                        <h5 class="card-title">Workout Tracking</h5>
                        <p class="card-text">Log your exercises and monitor your progress over time</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card h-100 text-center">
                    <div class="card-body">
                        <div class="feature-icon">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <h5 class="card-title">Progress Analytics</h5>
                        <p class="card-text">Visualize your progress with charts and achievement badges</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card h-100 text-center">
                    <div class="card-body">
                        <div class="feature-icon">
                            <i class="fas fa-robot"></i>
                        </div>
                        <h5 class="card-title">AI Trainer</h5>
                        <p class="card-text">Get personalized workout recommendations based on your goals</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-4 mb-4">
                <div class="card h-100 text-center">
                    <div class="card-body">
                        <div class="feature-icon">
                            <i class="fas fa-bell"></i>
                        </div>
                        <h5 class="card-title">Smart Reminders</h5>
                        <p class="card-text">Get notifications for workouts, hydration, and goals</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card h-100 text-center">
                    <div class="card-body">
                        <div class="feature-icon">
                            <i class="fas fa-microphone"></i>
                        </div>
                        <h5 class="card-title">Voice Assistant</h5>
                        <p class="card-text">Hands-free workout guidance with voice commands</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card h-100 text-center">
                    <div class="card-body">
                        <div class="feature-icon">
                            <i class="fas fa-cogs"></i>
                        </div>
                        <h5 class="card-title">Adaptive Workouts</h5>
                        <p class="card-text">Workouts that adjust to your mood and energy levels</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderWorkoutsPage(searchTerm = '', difficultyFilter = 'All') {
    let categoriesHtml = '';
    let workoutCount = 0;
    
    workoutData.categories.forEach(category => {
        const filteredWorkouts = category.workouts.filter(workout => {
            const matchesSearch = searchTerm ? workout.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
            const matchesDifficulty = difficultyFilter !== 'All' ? workout.difficulty === difficultyFilter : true;
            return matchesSearch && matchesDifficulty;
        });

        if (filteredWorkouts.length > 0) {
            let workoutsHtml = '';
            filteredWorkouts.forEach(workout => {
                workoutCount++;
            const isCompleted = currentUser && currentUser.completedWorkouts && 
                              currentUser.completedWorkouts.includes(workout.id);
            
            workoutsHtml += `
                <div class="col-md-6 col-lg-4 mb-4" >
                    <div class="card workout-card ${isCompleted ? 'border-primary' : ''}" data-bs-toggle="modal" data-bs-target="#exerciseDetailModal" data-id="${workout.id}" style="cursor: pointer;" data-loggable="true" data-workout-id="${workout.id}">
                        ${workout.images && workout.images.length > 0 ? `<img src="${workout.images[0]}" class="card-img-top workout-image" alt="${workout.name}" id="workout-img-${workout.id}">` : ''}
                        <div class="card-body" style="pointer-events: none;">
                            <h5 class="card-title">${workout.name}</h5>
                            <p class="card-text">Difficulty: <span class="badge bg-primary">${workout.difficulty}</span></p>
                            ${workout.duration ? `<p class="card-text">Duration: ${workout.duration} min</p>` : ''}
                            ${workout.sets ? `<p class="card-text">Sets: ${workout.sets}, Reps: ${workout.reps}</p>` : ''}
                            <p class="card-text mb-0">Calories: ~${workout.calories}</p>
                        </div>
                    </div>
                </div>
            `;
            });

            categoriesHtml += `
                <div class="mb-5">
                    <h2 class="mb-4 border-bottom pb-2">${category.name}</h2>
                    <div class="row">
                        ${workoutsHtml}
                    </div>
                </div>
            `;
        }
    });

    if (workoutCount === 0) {
        categoriesHtml = `<div class="alert alert-primary text-center">No workouts found matching your criteria.</div>`;
    }
    
    return `
        <h1 class="mb-4">Workout Library</h1>

        <!-- Search and Filter Controls -->
        <div class="row mb-4 filter-controls">
            <div class="col-lg-6 mb-2 mb-lg-0">
                <div class="input-group">
                    <input type="text" id="workout-search-input" class="form-control" placeholder="Search for an exercise..." value="${searchTerm}">
                    <button class="btn btn-outline-primary" type="button" id="workout-search-voice-btn"><i class="fas fa-microphone"></i></button>
                </div>
            </div>
            <div class="col-lg-6 d-flex">
                <div class="btn-group me-2" role="group" aria-label="Difficulty Filters">
                    <button type="button" class="btn ${difficultyFilter === 'All' ? 'btn-primary' : 'btn-outline-primary'} difficulty-filter-btn" data-difficulty="All">All</button>
                    <button type="button" class="btn ${difficultyFilter === 'Beginner' ? 'btn-primary' : 'btn-outline-primary'} difficulty-filter-btn" data-difficulty="Beginner">Beginner</button>
                    <button type="button" class="btn ${difficultyFilter === 'Intermediate' ? 'btn-primary' : 'btn-outline-primary'} difficulty-filter-btn" data-difficulty="Intermediate">Intermediate</button>
                    <button type="button" class="btn ${difficultyFilter === 'Advanced' ? 'btn-primary' : 'btn-outline-primary'} difficulty-filter-btn" data-difficulty="Advanced">Advanced</button>
                </div>
                <button class="btn btn-outline-primary" id="clear-filters-btn" title="Clear Filters"><i class="fas fa-times"></i></button>
            </div>
        </div>

        ${currentUser ? `
            <div class="alert alert-primary">
                <i class="fas fa-info-circle me-2"></i>You've completed ${currentUser.completedWorkouts ? currentUser.completedWorkouts.length : 0} workouts this week!
            </div>
        ` : ''}
        ${categoriesHtml}
        
        ${currentUser ? `
            <div class="card mt-5">
                <div class="card-header bg-primary text-white">
                    <h4 class="mb-0">Gamified Workout Challenges</h4>
                </div>
                <div class="card-body">
                    <div class="row text-center">
                        <div class="col-md-4 mb-3">
                            <div class="workout-badge bg-primary">
                                <i class="fas fa-fire"></i>
                            </div>
                            <h5>7-Day Streak</h5>
                            <p>Complete workouts for 7 consecutive days</p>
                            <span class="badge ${currentUser.streak >= 7 ? 'bg-primary' : 'bg-light text-dark'}">
                                ${currentUser.streak || 0}/7 days
                            </span>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="workout-badge bg-primary">
                                <i class="fas fa-dumbbell"></i>
                            </div>
                            <h5>Strength Master</h5>
                            <p>Complete all strength workouts</p>
                            <span class="badge bg-light text-dark">0/3 completed</span>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="workout-badge bg-primary">
                                <i class="fas fa-heart"></i>
                            </div>
                            <h5>Cardio Champion</h5>
                            <p>Complete all cardio workouts</p>
                            <span class="badge bg-light text-dark">0/3 completed</span>
                        </div>
                    </div>
                </div>
            </div>
        ` : ''}
    `;
}

function renderProgressPage() {
    if (!currentUser) {
        return `
            <div class="alert alert-primary text-center">
                <h4>Please log in to view your progress</h4>
                <a href="#" class="btn btn-primary mt-3" data-page="login">Login Now</a>
            </div>
        `;
    }
    
    const userWorkoutHistory = workoutHistory.filter(wh => wh.userId === currentUser.id);
    const completedCount = userWorkoutHistory.length;
    const totalCalories = calculateTotalCalories();
    const weeklyGoal = 10; // Example weekly goal
    const weeklyProgress = Math.min(100, Math.round((completedCount / weeklyGoal) * 100));

    // Generate achievements HTML
    const userStats = {
        'workout-count': completedCount,
        'calorie-burn': totalCalories,
        'workout-streak': currentUser.streak || 0
    };

    let achievementsHtml = '';
    for (const key in achievementsData) {
        const achievement = achievementsData[key];
        const userValue = userStats[key];
        let highestTierUnlocked = null;

        achievement.tiers.forEach(tier => {
            if (userValue >= tier.threshold) {
                highestTierUnlocked = { ...tier, unlocked: true };
            }
        });

        const nextTier = achievement.tiers.find(tier => userValue < tier.threshold);

        achievementsHtml += `
            <div class="col-md-4 mb-4">
                <div class="card h-100 achievement-card ${highestTierUnlocked ? 'unlocked' : ''}">
                    <div class="card-body text-center">
                        <div class="achievement-icon"><i class="fas ${achievement.icon} fa-2x"></i></div>
                        <h5 class="card-title">${achievement.title}</h5>
                        ${highestTierUnlocked ? `<p class="tier-unlocked text-primary">${highestTierUnlocked.name} Unlocked!</p><small>${highestTierUnlocked.description}</small>` : `<p class="text-muted">Keep going!</p>`}
                        ${nextTier ? `<div class="progress mt-2" style="height: 5px;"><div class="progress-bar" role="progressbar" style="width: ${Math.round((userValue / nextTier.threshold) * 100)}%;" aria-valuenow="${userValue}" aria-valuemin="0" aria-valuemax="${nextTier.threshold}"></div></div><small class="text-muted">Next: ${nextTier.name} (${nextTier.description})</small>` : '<p class="text-primary mt-2">All tiers unlocked!</p>'}
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <h1 class="mb-4">Your Progress</h1>
        
        <div class="row mb-5">
            <div class="col-md-3 text-center">
                <div class="progress-circle" data-progress="${weeklyProgress}" style="--progress: ${weeklyProgress}%"></div>
                <h5 class="mt-3">Weekly Goal</h5>
            </div>
            <div class="col-md-3 text-center">
                <h1 class="display-4 text-primary">${completedCount}</h1>
                <h5>Workouts Completed</h5>
            </div>
            <div class="col-md-3 text-center">
                <h1 class="display-4 text-primary">${currentUser.streak || 0}</h1>
                <h5>Day Streak</h5>
            </div>
            <div class="col-md-3 text-center">
                <h1 class="display-4 text-primary">${totalCalories}</h1>
                <h5>Calories Burned</h5>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Weekly Workout Completion</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="workoutChart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Calories Burned</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="caloriesChart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Achievements</h5>
            </div>
            <div class="card-body">
                <div class="row">${achievementsHtml}</div>
            </div>
        </div>
    `;
}

function renderAdaptiveWorkoutPage() {
    if (!currentUser) {
        return `
            <div class="alert alert-primary text-center">
                <h4>Please log in to use adaptive workouts</h4>
                <a href="#" class="btn btn-primary mt-3" data-page="login">Login Now</a>
            </div>
        `;
    }
    
    return `
        <h1 class="mb-4">Adaptive Workout Generator</h1>
        <p class="lead">Get personalized workout recommendations based on your current state</p>
        
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">How are you feeling today?</h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-4">
                            <label class="form-label">Energy Level</label>
                            <div class="d-flex justify-content-between">
                                <button class="btn btn-outline-primary energy-level-btn" data-level="low">Low</button>
                                <button class="btn btn-outline-primary energy-level-btn" data-level="medium">Medium</button>
                                <button class="btn btn-outline-primary energy-level-btn" data-level="high">High</button>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="form-label">Mood</label>
                            <div class="d-flex justify-content-between">
                                <button class="btn btn-outline-primary mood-btn" data-mood="tired">Tired</button>
                                <button class="btn btn-outline-primary mood-btn" data-mood="neutral">Neutral</button>
                                <button class="btn btn-outline-primary mood-btn" data-mood="energetic">Energetic</button>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="form-label">Time Available (minutes)</label>
                            <input type="range" class="form-range" id="time-available" min="10" max="60" step="5" value="30">
                            <div class="text-center" id="time-value">30 minutes</div>
                        </div>
                        
                        <div class="mb-4">
                            <label for="focus-area" class="form-label">Focus Area (Optional)</label>
                            <select class="form-select" id="focus-area">
                                <option value="any">Any</option>
                                <option value="Upper Body">Upper Body</option>
                                <option value="Lower Body">Lower Body</option>
                                <option value="Core">Core</option>
                            </select>
                        </div>
                        
                        <button class="btn btn-primary w-100" id="generate-workout-btn">Generate Workout</button>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Your Recommended Workout</h5>
                    </div>
                    <div class="card-body text-center" id="recommended-workout">
                        <div class="text-muted">
                            <i class="fas fa-dumbbell fa-3x mb-3"></i>
                            <p>Fill out the form to generate your personalized workout</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">How It Works</h5>
            </div>
            <div class="card-body">
                <p>Our adaptive workout system uses your current energy level, mood, and available time to create a personalized workout that matches your needs:</p>
                <ul>
                    <li><strong>Low energy</strong> = Light stretching and recovery workouts</li>
                    <li><strong>Medium energy</strong> = Balanced strength training</li>
                    <li><strong>High energy</strong> = Intense strength and conditioning workouts</li>
                </ul>
            </div>
        </div>
    `;
}

function renderNotificationsPage() {
    if (!currentUser) {
        return `
            <div class="alert alert-primary text-center">
                <h4>Please log in to manage notifications</h4>
                <a href="#" class="btn btn-primary mt-3" data-page="login">Login Now</a>
            </div>
        `;
    }
    
    const userNotifications = notifications.filter(n => n.userId === currentUser.id);
    
    let notificationsHtml = '';
    
    if (userNotifications.length === 0) {
        notificationsHtml = '<p class="text-center text-muted">No notifications yet</p>';
    } else {
        userNotifications.forEach(notification => {
            notificationsHtml += `
                <div class="d-flex align-items-center p-3 border-bottom">
                    <div class="me-3 text-primary">
                        <i class="fas fa-info-circle fa-2x"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${notification.title}</h6>
                        <small class="text-muted">Scheduled for: ${notification.time}</small>
                        <p class="mb-0 mt-1">${notification.message}</p>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary edit-notification me-2" data-id="${notification.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-primary delete-notification" data-id="${notification.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    return `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="mb-0">Notifications & Reminders</h1>
            <button class="btn btn-primary" id="add-notification-btn">
                <i class="fas fa-plus me-2"></i>Set New Reminder
            </button>
        </div>
        
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Your Reminders</h5>
            </div>
            <div class="card-body p-0">
                ${notificationsHtml}
            </div>
        </div>
    `;
}

function renderPerformancePage() {
    if (!currentUser) {
        return `
            <div class="alert alert-primary text-center">
                <h4>Please log in to view performance tracking</h4>
                <a href="#" class="btn btn-primary mt-3" data-page="login">Login Now</a>
            </div>
        `;
    }
    
    const performanceData = calculateOverallPerformance();

    return `
        <h1 class="mb-4">Performance Tracking</h1>
        <p class="lead">Monitor your workout performance and get real-time feedback</p>
        
        <div class="row">
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Overall Performance Score</h5>
                    </div>
                    <div class="card-body text-center">
                        <div class="progress-circle" data-progress="${performanceData.score}" style="--progress: ${performanceData.score}%"></div>
                        <h4 class="mt-3">${performanceData.score}/100</h4>
                        <p class="text-muted">Based on your recent workouts</p>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Performance Metrics</h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <div class="d-flex justify-content-between">
                                <span>Consistency</span>
                                <span>${performanceData.consistency}%</span>
                            </div>
                            <div class="progress" style="height: 10px;">
                                <div class="progress-bar bg-primary" style="width: ${performanceData.consistency}%"></div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="d-flex justify-content-between">
                                <span>Intensity</span>
                                <span>${performanceData.intensity}%</span>
                            </div>
                            <div class="progress" style="height: 10px;">
                                <div class="progress-bar bg-primary" style="width: ${performanceData.intensity}%"></div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="d-flex justify-content-between">
                                <span>Progress Rate</span>
                                <span>${performanceData.progress}%</span>
                            </div>
                            <div class="progress" style="height: 10px;">
                                <div class="progress-bar bg-primary" style="width: ${performanceData.progress}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card mb-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Performance by Category</h5>
            </div>
            <div class="card-body">
                <canvas id="performanceChart" width="400" height="200"></canvas>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Personalized Feedback</h5>
            </div>
            <div class="card-body">
                <div class="alert alert-success">
                    <h6><i class="fas fa-check-circle me-2"></i>Great job on consistency!</h6>
                    <p class="mb-0">Your consistency score reflects how regularly you've been working out over the last 30 days.</p>
                </div>
                
                <div class="alert alert-info">
                    <h6><i class="fas fa-info-circle me-2"></i>Try increasing intensity</h6>
                    <p class="mb-0">Your intensity score is based on the difficulty of the workouts you choose. Challenge yourself with more advanced exercises to boost it!</p>
                </div>
                
                <div class="alert alert-warning">
                    <h6><i class="fas fa-exclamation-triangle me-2"></i>Focus on progressive overload</h6>
                    <p class="mb-0">Your progress rate is a measure of your workout streak and total completed workouts. Keep it up to see this number grow!</p>
                </div>
            </div>
        </div>
    `;
}

function renderRegisterPage() {
    return `
        <div class="row justify-content-center">
            <div class="col-md-8 col-lg-6">
                <div class="card">
                    <div class="card-header bg-primary text-white text-center">
                        <h3 class="mb-0">Create Your Account</h3>
                    </div>
                    <div class="card-body">
                        <form id="registration-form">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="name" class="form-label">Full Name</label>
                                    <input type="text" class="form-control" id="name" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="password" class="form-label">Password</label>
                                    <input type="password" class="form-control" id="password" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="phone" class="form-label">Phone Number (optional)</label>
                                    <input type="tel" class="form-control" id="phone">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Fitness Level</label>
                                    <select class="form-select" id="fitness-level">
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Primary Goal</label>
                                    <select class="form-select" id="fitness-goals">
                                        <option value="weightloss">Weight Loss</option>
                                        <option value="musclegain">Muscle Gain</option>
                                        <option value="endurance">Endurance</option>
                                        <option value="flexibility">Flexibility</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">How did you hear about us?</label>
                                <div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="referral" id="social" value="social">
                                        <label class="form-check-label" for="social">Social Media</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="referral" id="friend" value="friend">
                                        <label class="form-check-label" for="friend">Friend</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="referral" id="search" value="search">
                                        <label class="form-check-label" for="search">Search Engine</label>
                                    </div>
                                </div>
                            </div>
                            <div class="d-grid">
                                <button type="submit" class="btn btn-primary btn-lg">Create Account</button>
                            </div>
                        </form>
                        <div class="text-center mt-3">
                            <p>Already have an account? <a href="#" data-page="login">Login here</a></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderLoginPage() {
    return `
        <div class="row justify-content-center">
            <div class="col-md-6 col-lg-5">
                <div class="card">
                    <div class="card-header bg-primary text-white text-center">
                        <h3 class="mb-0">Login to Your Account</h3>
                    </div>
                    <div class="card-body">
                        <form id="login-form">
                            <div class="mb-3">
                                <label for="login-email" class="form-label">Email</label>
                                <input type="email" class="form-control" id="login-email" required>
                            </div>
                            <div class="mb-3">
                                <label for="login-password" class="form-label">Password</label>
                                <input type="password" class="form-control" id="login-password" required>
                            </div>
                            <div class="mb-3 form-check">
                                <input type="checkbox" class="form-check-input" id="remember-me">
                                <label class="form-check-label" for="remember-me">Remember me</label>
                            </div>
                            <div class="d-grid">
                                <button type="submit" class="btn btn-primary btn-lg">Login</button>
                            </div>
                        </form>
                        <div class="text-center mt-3">
                            <p>Don't have an account? <a href="#" data-page="register">Register here</a></p>
                        </div>
                        <div class="text-center mt-4">
                            <p>Or login with:</p>
                            <div>
                                <button class="btn btn-outline-dark me-2"><i class="fab fa-google"></i> Google</button>
                                <button class="btn btn-outline-primary"><i class="fab fa-facebook"></i> Facebook</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDashboard(lastWorkout = null) {
    if (!currentUser) {
        loadPage('login');
        return '';
    }
    
    let recommendationHtml = '';
    if (lastWorkout) {
        recommendationHtml = `
            <div class="card h-100">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0">Resume Where You Left Off</h5>
                </div>
                <div class="card-body d-flex flex-column">
                    <h6 class="card-title">${lastWorkout.name}</h6>
                    <p class="card-text text-muted flex-grow-1">Your last completed exercise. Ready for another round?</p>
                    <button class="btn btn-primary w-100 mt-auto" data-bs-toggle="modal" data-bs-target="#exerciseDetailModal" data-id="${lastWorkout.id}" data-loggable="true">
                        <i class="fas fa-play me-2"></i>Resume Workout
                    </button>
                </div>
            </div>
        `;
    } else {
        recommendationHtml = `
            <div class="card h-100">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0">Recommended For You</h5>
                </div>
                <div class="card-body d-flex flex-column">
                    <p class="text-muted flex-grow-1">Complete a workout to get personalized recommendations here.</p>
                    <button class="btn btn-outline-primary w-100 mt-auto" data-page="workouts">Explore Workouts</button>
                </div>
            </div>
        `;
    }

    let savedDietPlanHtml = '';
    if (currentUser.savedDietPlan) {
        savedDietPlanHtml = `
            <div class="card h-100">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0">Your Saved Diet Plan</h5>
                </div>
                <div class="card-body d-flex flex-column">
                    <p class="card-text text-muted flex-grow-1">
                        Your plan for ${currentUser.savedDietPlan.goal} at ~${currentUser.savedDietPlan.targetCalories} calories.
                    </p>
                    <button class="btn btn-primary w-100 mt-auto" data-page="diet">
                        <i class="fas fa-eye me-2"></i>View My Plan
                    </button>
                </div>
            </div>
        `;
    }
    const completedWorkouts = currentUser.completedWorkouts ? currentUser.completedWorkouts.length : 0;
    const progressPercentage = Math.min(100, Math.round((completedWorkouts / 10) * 100));
    
    return `
        <h1 class="mb-4">Welcome back, ${currentUser.name.split(' ')[0]}!</h1>
        
        <div class="row">
            <div class="col-md-3 mb-4">
                <div class="card text-center">
                    <div class="card-body">
                        <div class="text-primary">
                            <i class="fas fa-dumbbell fa-2x"></i>
                        </div>
                        <h5 class="card-title mt-2">Workouts This Week</h5>
                        <p class="display-4">${completedWorkouts}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-4">
                <div class="card text-center">
                    <div class="card-body">
                        <div class="text-primary">
                            <i class="fas fa-fire fa-2x"></i>
                        </div>
                        <h5 class="card-title mt-2">Calories Burned</h5>
                        <p class="display-4">${calculateTotalCalories()}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-4">
                <div class="card text-center">
                    <div class="card-body">
                        <div class="text-primary">
                            <i class="fas fa-calendar fa-2x"></i>
                        </div>
                        <h5 class="card-title mt-2">Current Streak</h5>
                        <p class="display-4">${currentUser.streak || 0}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-4">
                <div class="card text-center">
                    <div class="card-body">
                        <div class="text-primary">
                            <i class="fas fa-trophy fa-2x"></i>
                        </div>
                        <h5 class="card-title mt-2">Achievements</h5>
                        <p class="display-4">${calculateAchievements()}</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-8 mb-4">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Weekly Progress</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="dashboardChart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Today's Goal</h5>
                    </div>
                    <div class="card-body text-center">
                        <div class="progress-circle" data-progress="${progressPercentage}" style="--progress: ${progressPercentage}%"></div>
                        <h5 class="mt-3">${progressPercentage}% Complete</h5>
                        <p class="text-muted">${completedWorkouts} of 10 workouts this week</p>
                        <button class="btn btn-primary mt-2" data-page="workouts">Log Workout</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-6 mb-4 d-flex">
                ${recommendationHtml}
            </div>
            <div class="col-md-6 mb-4 d-flex">
                <div class="card h-100 w-100">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Recent Activities</h5>
                    </div>
                    <div class="card-body">
                        ${renderRecentActivities()}
                    </div>
                </div>
            </div>
            ${
                savedDietPlanHtml ? `
                <div class="col-md-6 mb-4 d-flex">
                    ${savedDietPlanHtml}
                </div>
                <div class="col-md-6 mb-4 d-flex">
                    <div class="card h-100 w-100">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0">Saved Plan Macronutrients</h5>
                        </div>
                        <div class="card-body d-flex justify-content-center align-items-center">
                            <canvas id="macroChart" style="max-height: 250px;"></canvas>
                        </div>
                    </div>
                </div>
            ` : ''
            }
        </div>
    `;
}

function renderDietPlanPage() {
    if (!currentUser) {
        return `
            <div class="alert alert-primary text-center">
                <h4>Please log in to generate a diet plan</h4>
                <a href="#" class="btn btn-primary mt-3" data-page="login">Login Now</a>
            </div>
        `;
    }

    // If a plan is already saved, show it instead of the form
    if (currentUser.savedDietPlan) {
        return `
            ${renderDietResult(currentUser.savedDietPlan)}
            <button class="btn btn-outline-primary mt-4" id="clear-saved-plan-btn"><i class="fas fa-trash me-2"></i>Clear Saved Plan & Start New</button>
        `;
    }
    return `
        <h1 class="mb-4">Custom Diet Plan Generator</h1>
        <div class="card">
            <div class="card-body">
                <form id="diet-plan-form">
                    <!-- Step 1: Goal and Preference -->
                    <div id="diet-step-1">
                        <h4 class="mb-3">Step 1: Your Goals</h4>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Primary Goal</label>
                                <select class="form-select" id="diet-goal" required>
                                    <option value="" disabled selected>Choose your goal...</option>
                                    <option value="cutting">Cutting (Lose Fat)</option>
                                    <option value="bulking">Bulking (Gain Muscle)</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Dietary Preference</label>
                                <select class="form-select" id="diet-preference" required>
                                    <option value="" disabled selected>Choose your preference...</option>
                                    <option value="All">All</option>
                                    <option value="Veg">Vegetarian</option>
                                    <option value="Non-Veg">Non-Vegetarian</option>
                                    <option value="Vegan">Vegan</option>
                                </select>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="ingredient-search" class="form-label">Include a specific ingredient? (optional)</label>
                            <input type="text" class="form-control" id="ingredient-search" placeholder="e.g., Chicken, Broccoli, Paneer">
                        </div>
                        <button type="button" class="btn btn-primary" id="diet-next-1">Next</button>
                    </div>

                    <!-- Step 2: Biometrics -->
                    <div id="diet-step-2" style="display: none;">
                        <h4 class="mb-3">Step 2: Your Details</h4>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Gender</label>
                                <select class="form-select" id="diet-gender" required>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="diet-age" class="form-label">Age</label>
                                <input type="number" class="form-control" id="diet-age" placeholder="e.g., 25" required>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="diet-weight" class="form-label">Weight (kg)</label>
                                <input type="number" class="form-control" id="diet-weight" placeholder="e.g., 70" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="diet-height" class="form-label">Height (cm)</label>
                                <input type="number" class="form-control" id="diet-height" placeholder="e.g., 175" required>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Activity Level</label>
                            <select class="form-select" id="diet-activity" required>
                                <option value="1.2">Sedentary (little or no exercise)</option>
                                <option value="1.375">Lightly Active (light exercise/sports 1-3 days/week)</option>
                                <option value="1.55" selected>Moderately Active (moderate exercise/sports 3-5 days/week)</option>
                                <option value="1.725">Very Active (hard exercise/sports 6-7 days a week)</option>
                                <option value="1.9">Extra Active (very hard exercise/sports & physical job)</option>
                            </select>
                        </div>
                        <button type="button" class="btn btn-secondary" id="diet-back-2">Back</button>
                        <button type="submit" class="btn btn-primary" id="generate-diet-plan-btn">
                            Update & Generate Plan <span class="badge bg-light text-dark ms-2" id="plan-regen-count"></span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Result Area -->
        <div id="diet-result-container" class="mt-4" style="display: none;"></div>
    `;
}

function renderMealCard(meal, mealType) {
    // Determine badge color based on meal type
    const mealTypeColors = {
        breakfast: 'bg-primary text-white',
        lunch: 'bg-primary text-white',
        dinner: 'bg-primary text-white'
    };
    const badgeClass = mealTypeColors[mealType] || 'bg-primary';

    // Handle potential missing image
    const imageUrl = (meal && meal.image && meal.image.startsWith('images/recipes/')) ? meal.image : 'images/diet/placeholder.JPG';
    const imageErrorScript = `this.onerror=null; this.src='images/diet/placeholder.JPG';`; // Fallback for genuinely broken local images

    // Handle preference badge
    const preferenceColors = {
        'Vegetarian': 'bg-light text-dark',
        'Vegan': 'bg-light text-dark',
        'Non-Vegetarian': 'bg-light text-dark'
    };
    const preferenceBadge = `<span class="badge ${preferenceColors[meal.preference] || 'bg-secondary'} diet-card-preference-badge">${meal.preference}</span>`;
    return `
        <div class="col-md-6 col-lg-4 mb-4 meal-card-container" data-meal-type="${mealType}">
            <div class="card h-100 diet-card shadow-sm">
                <div class="diet-card-img-container">
                    <img src="${imageUrl}" class="card-img-top" alt="${meal.name}" onerror="${imageErrorScript}">
                    <span class="badge ${badgeClass} diet-card-badge">${mealType.charAt(0).toUpperCase() + mealType.slice(1)}</span>
                </div>
                ${preferenceBadge}
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title text-center">${meal.name}</h5>
                    <div class="d-flex justify-content-around text-center my-3 macro-grid">
                        <div>
                            <p class="mb-0 fs-5 fw-bold text-primary">${meal.calories}</p>
                            <small class="text-muted">Calories</small>
                        </div>
                        <div>
                            <p class="mb-0 fs-5 fw-bold text-primary">${meal.protein}g</p>
                            <small class="text-muted">Protein</small>
                        </div>
                        <div>
                            <p class="mb-0 fs-5 fw-bold text-primary">${meal.carbs}g</p>
                            <small class="text-muted">Carbs</small>
                        </div>
                        <div>
                            <p class="mb-0 fs-5 fw-bold text-primary">${meal.fats}g</p>
                            <small class="text-muted">Fats</small>
                        </div>
                    </div>
                    <div class="mt-auto">
                        <details class="diet-details mb-2">
                            <summary class="btn btn-outline-secondary w-100"><i class="fas fa-utensils me-2"></i>View Recipe</summary>
                            <div class="diet-details-content mt-3">
                                <h6>Ingredients:</h6>
                                <ul class="list-unstyled">
                                    ${meal.ingredients.split('\n').map(item => item.trim() ? `<li>- ${item.trim()}</li>` : '').join('')}
                                </ul>
                                <h6 class="mt-3">Preparation:</h6>
                                <p>${meal.preparation}</p>
                            </div>
                        </details>
                        <button class="btn btn-outline-primary w-100 regenerate-meal-btn" data-meal-type="${mealType}">
                            <i class="fas fa-sync-alt me-2"></i>Regenerate
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDietResult(plan) {
    const mealCards = ['breakfast', 'lunch', 'dinner'].map(mealType => {
        const meal = plan.meals[mealType];
        return meal ? renderMealCard(meal, mealType) : '';
    }).join('');

    return `
        <h2 class="mb-3">Your Custom Diet Plan</h2>
        <div class="alert alert-primary">Your estimated <strong>${plan.goal}</strong> target is <strong>${plan.targetCalories} calories</strong> per day. This plan provides approximately <strong>${plan.totalCalories} calories</strong>.</div>
        <div class="row">${mealCards}</div>
        <div class="d-grid gap-2 mt-4">
            <button class="btn btn-lg btn-primary" id="save-diet-plan-btn">
                <i class="fas fa-save me-2"></i>Save This Plan
            </button>
        </div>
    `;
}

function renderRecentActivities() {
    if (!currentUser || !workoutHistory.length) {
        return '<p class="text-muted text-center">No recent activities</p>';
    }

    const userWorkouts = workoutHistory
        .filter(wh => wh.userId === currentUser.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    let activitiesHtml = '';

    userWorkouts.forEach(workout => {
        const workoutDetails = getAllWorkouts().find(w => w.id == workout.workoutId);
        if (workoutDetails) {
            activitiesHtml += `
                <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                    <div>
                        <h6 class="mb-0">${workoutDetails.name}</h6>
                        <small class="text-muted">${new Date(workout.date).toLocaleDateString()}</small>
                    </div>
                    <span class="badge bg-primary">${workoutDetails.calories} cal</span>
                </div>
            `;
        }
    });

    return activitiesHtml;
}