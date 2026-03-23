/**
 * OpenPecker Chess — i18n translations
 * Supported languages: English (en), Hindi (hi)
 */

export type Language = 'en' | 'hi';

export const translations = {
  en: {
    // ── App-wide ──────────────────────────────────────────────────────────────
    appName: 'OpenPecker Chess',
    appTagline: 'Master opening tactics through deliberate repetition.',

    // ── BottomNav ─────────────────────────────────────────────────────────────
    nav: {
      home: 'HOME',
      train: 'TRAIN',
      sets: 'SETS',
      rank: 'RANK',
      stats: 'STATS',
      more: 'MORE',
    },

    // ── Home ──────────────────────────────────────────────────────────────────
    home: {
      welcome: 'Welcome,',
      startTraining: 'START TRAINING →',
      signIn: 'Sign in to save your progress',
      loginButton: 'Login / Sign Up',
      language: 'Language',
    },

    // ── Train ─────────────────────────────────────────────────────────────────
    train: {
      title: 'Train',
      selectOpening: 'Select an Opening',
      searchPlaceholder: 'Search openings...',
      startSession: 'Start Session',
      puzzles: 'puzzles',
      sets: 'sets',
      noOpenings: 'No openings found.',
    },

    // ── Session ───────────────────────────────────────────────────────────────
    session: {
      back: 'Back',
      time: 'Time',
      sets: 'Sets',
      puzzlesSolved: 'Puzzles Solved',
      correct: 'Correct!',
      incorrect: 'Incorrect',
      solving: 'Solving...',
      yourTurn: 'Your turn',
      opponentTurn: "Opponent's turn",
      sessionComplete: 'Session Complete',
      accuracy: 'Accuracy',
      totalTime: 'Total Time',
      puzzlesCompleted: 'Puzzles Completed',
      continueTraining: 'Continue Training',
      backToSets: 'Back to Sets',
      hint: 'Hint',
      skip: 'Skip',
    },

    // ── Sets ──────────────────────────────────────────────────────────────────
    sets: {
      title: 'Training Sets',
      mySets: 'My Sets',
      allSets: 'All Sets',
      createSet: 'Create Set',
      noSets: 'No sets yet. Start training to create your first set!',
      puzzleCount: 'puzzles',
      accuracy: 'Accuracy',
      lastPlayed: 'Last played',
      play: 'Play',
      edit: 'Edit',
      delete: 'Delete',
      cycle: 'Cycle',
      completed: 'Completed',
      inProgress: 'In Progress',
      notStarted: 'Not Started',
    },

    // ── Leaderboard ───────────────────────────────────────────────────────────
    leaderboard: {
      title: 'Leaderboard',
      rank: 'Rank',
      player: 'Player',
      puzzlesSolved: 'Puzzles Solved',
      accuracy: 'Accuracy',
      rating: 'Rating',
      time: 'Time',
      activePlayers: 'Active Players',
      totalPlayers: 'Total Players',
      globalPuzzlesSolved: 'Puzzles Solved Globally',
      loading: 'Loading leaderboard...',
      noPlayers: 'No players yet. Be the first!',
      you: 'You',
      minutes: 'min',
    },

    // ── Stats ─────────────────────────────────────────────────────────────────
    stats: {
      title: 'Statistics',
      totalPuzzles: 'Total Puzzles',
      accuracy: 'Accuracy',
      totalTime: 'Total Time',
      currentStreak: 'Current Streak',
      bestStreak: 'Best Streak',
      rating: 'Rating',
      days: 'days',
      minutes: 'min',
      noData: 'No data yet. Start training to see your stats!',
      puzzlesByOpening: 'Puzzles by Opening',
      recentActivity: 'Recent Activity',
      weeklyProgress: 'Weekly Progress',
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    settings: {
      title: 'Settings',
      boardTheme: 'Board Theme',
      boardThemeDesc: 'Choose your preferred chess board colors',
      classic: 'Classic',
      green: 'Green',
      blue: 'Blue',
      purple: 'Purple',
      sound: 'Sound',
      soundDesc: 'Enable move sounds',
      animation: 'Animation',
      animationDesc: 'Enable piece animations',
      language: 'Language',
      languageDesc: 'Choose your preferred language',
      account: 'Account',
      logout: 'Logout',
      deleteAccount: 'Delete Account',
      saved: 'Settings saved!',
      profile: 'Profile',
      displayName: 'Display Name',
      save: 'Save',
    },

    // ── Profile ───────────────────────────────────────────────────────────────
    profile: {
      title: 'Profile',
      editName: 'Edit Name',
      memberSince: 'Member since',
      totalPuzzles: 'Total Puzzles',
      accuracy: 'Accuracy',
      rank: 'Rank',
    },

    // ── Auth ──────────────────────────────────────────────────────────────────
    auth: {
      signingIn: 'Signing you in...',
      welcome: 'Welcome back!',
      error: 'Authentication failed. Please try again.',
    },

    // ── NotFound ──────────────────────────────────────────────────────────────
    notFound: {
      title: 'Page Not Found',
      message: "The page you're looking for doesn't exist.",
      goHome: 'Go Home',
    },

    // ── PWA Install ───────────────────────────────────────────────────────────
    pwa: {
      installTitle: 'Install OpenPecker Chess',
      installDesc: 'Add to your home screen for the best experience.',
      install: 'Install',
      dismiss: 'Not now',
    },

    // ── Premium ───────────────────────────────────────────────────────────────
    premium: {
      title: 'Go Premium',
      desc: 'Unlock unlimited sets and advanced analytics.',
      upgrade: 'Upgrade Now',
      alreadyPremium: 'You are Premium',
    },

    // ── Name selection ────────────────────────────────────────────────────────
    nameDialog: {
      title: 'Choose your display name',
      placeholder: 'Enter your name...',
      confirm: 'Confirm',
      cancel: 'Cancel',
    },

    // ── General ───────────────────────────────────────────────────────────────
    general: {
      loading: 'Loading...',
      error: 'Something went wrong.',
      retry: 'Retry',
      cancel: 'Cancel',
      save: 'Save',
      close: 'Close',
      confirm: 'Confirm',
      delete: 'Delete',
      edit: 'Edit',
      back: 'Back',
      next: 'Next',
      done: 'Done',
      yes: 'Yes',
      no: 'No',
    },
  },

  hi: {
    // ── App-wide ──────────────────────────────────────────────────────────────
    appName: 'OpenPecker Chess',
    appTagline: 'जानबूझकर दोहराव के माध्यम से शुरुआती रणनीति में महारत हासिल करें।',

    // ── BottomNav ─────────────────────────────────────────────────────────────
    nav: {
      home: 'होम',
      train: 'अभ्यास',
      sets: 'सेट',
      rank: 'रैंक',
      stats: 'आँकड़े',
      more: 'अधिक',
    },

    // ── Home ──────────────────────────────────────────────────────────────────
    home: {
      welcome: 'स्वागत है,',
      startTraining: 'अभ्यास शुरू करें →',
      signIn: 'अपनी प्रगति सहेजने के लिए साइन इन करें',
      loginButton: 'लॉगिन / साइन अप',
      language: 'भाषा',
    },

    // ── Train ─────────────────────────────────────────────────────────────────
    train: {
      title: 'अभ्यास',
      selectOpening: 'एक ओपनिंग चुनें',
      searchPlaceholder: 'ओपनिंग खोजें...',
      startSession: 'सत्र शुरू करें',
      puzzles: 'पहेलियाँ',
      sets: 'सेट',
      noOpenings: 'कोई ओपनिंग नहीं मिली।',
    },

    // ── Session ───────────────────────────────────────────────────────────────
    session: {
      back: 'वापस',
      time: 'समय',
      sets: 'सेट',
      puzzlesSolved: 'हल की गई पहेलियाँ',
      correct: 'सही!',
      incorrect: 'गलत',
      solving: 'हल हो रहा है...',
      yourTurn: 'आपकी बारी',
      opponentTurn: 'प्रतिद्वंद्वी की बारी',
      sessionComplete: 'सत्र पूर्ण',
      accuracy: 'सटीकता',
      totalTime: 'कुल समय',
      puzzlesCompleted: 'पूर्ण पहेलियाँ',
      continueTraining: 'अभ्यास जारी रखें',
      backToSets: 'सेट पर वापस',
      hint: 'संकेत',
      skip: 'छोड़ें',
    },

    // ── Sets ──────────────────────────────────────────────────────────────────
    sets: {
      title: 'प्रशिक्षण सेट',
      mySets: 'मेरे सेट',
      allSets: 'सभी सेट',
      createSet: 'सेट बनाएं',
      noSets: 'अभी तक कोई सेट नहीं। अपना पहला सेट बनाने के लिए अभ्यास शुरू करें!',
      puzzleCount: 'पहेलियाँ',
      accuracy: 'सटीकता',
      lastPlayed: 'अंतिम बार खेला',
      play: 'खेलें',
      edit: 'संपादित करें',
      delete: 'हटाएं',
      cycle: 'चक्र',
      completed: 'पूर्ण',
      inProgress: 'जारी है',
      notStarted: 'शुरू नहीं हुआ',
    },

    // ── Leaderboard ───────────────────────────────────────────────────────────
    leaderboard: {
      title: 'लीडरबोर्ड',
      rank: 'रैंक',
      player: 'खिलाड़ी',
      puzzlesSolved: 'हल की गई पहेलियाँ',
      accuracy: 'सटीकता',
      rating: 'रेटिंग',
      time: 'समय',
      activePlayers: 'सक्रिय खिलाड़ी',
      totalPlayers: 'कुल खिलाड़ी',
      globalPuzzlesSolved: 'विश्व स्तर पर हल की गई पहेलियाँ',
      loading: 'लीडरबोर्ड लोड हो रहा है...',
      noPlayers: 'अभी तक कोई खिलाड़ी नहीं। पहले बनें!',
      you: 'आप',
      minutes: 'मिनट',
    },

    // ── Stats ─────────────────────────────────────────────────────────────────
    stats: {
      title: 'आँकड़े',
      totalPuzzles: 'कुल पहेलियाँ',
      accuracy: 'सटीकता',
      totalTime: 'कुल समय',
      currentStreak: 'वर्तमान स्ट्रीक',
      bestStreak: 'सर्वश्रेष्ठ स्ट्रीक',
      rating: 'रेटिंग',
      days: 'दिन',
      minutes: 'मिनट',
      noData: 'अभी तक कोई डेटा नहीं। अपने आँकड़े देखने के लिए अभ्यास शुरू करें!',
      puzzlesByOpening: 'ओपनिंग के अनुसार पहेलियाँ',
      recentActivity: 'हाल की गतिविधि',
      weeklyProgress: 'साप्ताहिक प्रगति',
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    settings: {
      title: 'सेटिंग्स',
      boardTheme: 'बोर्ड थीम',
      boardThemeDesc: 'अपना पसंदीदा शतरंज बोर्ड रंग चुनें',
      classic: 'क्लासिक',
      green: 'हरा',
      blue: 'नीला',
      purple: 'बैंगनी',
      sound: 'ध्वनि',
      soundDesc: 'चाल की ध्वनि सक्षम करें',
      animation: 'एनिमेशन',
      animationDesc: 'मोहरे की एनिमेशन सक्षम करें',
      language: 'भाषा',
      languageDesc: 'अपनी पसंदीदा भाषा चुनें',
      account: 'खाता',
      logout: 'लॉगआउट',
      deleteAccount: 'खाता हटाएं',
      saved: 'सेटिंग्स सहेजी गई!',
      profile: 'प्रोफ़ाइल',
      displayName: 'प्रदर्शन नाम',
      save: 'सहेजें',
    },

    // ── Profile ───────────────────────────────────────────────────────────────
    profile: {
      title: 'प्रोफ़ाइल',
      editName: 'नाम संपादित करें',
      memberSince: 'सदस्य बने',
      totalPuzzles: 'कुल पहेलियाँ',
      accuracy: 'सटीकता',
      rank: 'रैंक',
    },

    // ── Auth ──────────────────────────────────────────────────────────────────
    auth: {
      signingIn: 'साइन इन हो रहे हैं...',
      welcome: 'वापस स्वागत है!',
      error: 'प्रमाणीकरण विफल। कृपया पुनः प्रयास करें।',
    },

    // ── NotFound ──────────────────────────────────────────────────────────────
    notFound: {
      title: 'पृष्ठ नहीं मिला',
      message: 'आप जो पृष्ठ ढूंढ रहे हैं वह मौजूद नहीं है।',
      goHome: 'होम पर जाएं',
    },

    // ── PWA Install ───────────────────────────────────────────────────────────
    pwa: {
      installTitle: 'OpenPecker Chess इंस्टॉल करें',
      installDesc: 'सर्वोत्तम अनुभव के लिए अपनी होम स्क्रीन पर जोड़ें।',
      install: 'इंस्टॉल करें',
      dismiss: 'अभी नहीं',
    },

    // ── Premium ───────────────────────────────────────────────────────────────
    premium: {
      title: 'प्रीमियम लें',
      desc: 'असीमित सेट और उन्नत विश्लेषण अनलॉक करें।',
      upgrade: 'अभी अपग्रेड करें',
      alreadyPremium: 'आप प्रीमियम हैं',
    },

    // ── Name selection ────────────────────────────────────────────────────────
    nameDialog: {
      title: 'अपना प्रदर्शन नाम चुनें',
      placeholder: 'अपना नाम दर्ज करें...',
      confirm: 'पुष्टि करें',
      cancel: 'रद्द करें',
    },

    // ── General ───────────────────────────────────────────────────────────────
    general: {
      loading: 'लोड हो रहा है...',
      error: 'कुछ गलत हो गया।',
      retry: 'पुनः प्रयास करें',
      cancel: 'रद्द करें',
      save: 'सहेजें',
      close: 'बंद करें',
      confirm: 'पुष्टि करें',
      delete: 'हटाएं',
      edit: 'संपादित करें',
      back: 'वापस',
      next: 'अगला',
      done: 'हो गया',
      yes: 'हाँ',
      no: 'नहीं',
    },
  },
} as const;

export type TranslationKey = typeof translations.en;
