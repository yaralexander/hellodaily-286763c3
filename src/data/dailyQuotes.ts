// 366 daily motivational quotes — Osho, Buddhism, business wisdom
const quotes = {
  en: [
    { text: "Be realistic: Plan for a miracle.", author: "Osho" },
    { text: "The mind is everything. What you think you become.", author: "Buddha" },
    { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
    { text: "Experience life in all possible ways — good-bad, bitter-sweet, dark-light, summer-winter.", author: "Osho" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Drop the idea of becoming someone, because you are already a masterpiece.", author: "Osho" },
    { text: "Peace comes from within. Do not seek it without.", author: "Buddha" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Creativity is the greatest rebellion in existence.", author: "Osho" },
    { text: "Health is the greatest gift, contentment the greatest wealth.", author: "Buddha" },
    { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
    { text: "If you are a parent, open doors to unknown directions to the child so he can explore.", author: "Osho" },
    { text: "Three things cannot be long hidden: the sun, the moon, and the truth.", author: "Buddha" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Sadness gives depth. Happiness gives height. Sadness gives roots. Happiness gives branches.", author: "Osho" },
    { text: "You will not be punished for your anger, you will be punished by your anger.", author: "Buddha" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Life begins where fear ends.", author: "Osho" },
    { text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.", author: "Buddha" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Courage is not the absence of fear but the judgment that something else is more important.", author: "Osho" },
    { text: "What we think, we become.", author: "Buddha" },
    { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { text: "The capacity to be alone is the capacity to love.", author: "Osho" },
    { text: "An idea that is developed and put into action is more important than an idea that exists only as an idea.", author: "Buddha" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "Intelligence is the ability to adapt to change.", author: "Stephen Hawking" },
    { text: "To be creative means to be in love with life.", author: "Osho" },
    { text: "Every morning we are born again. What we do today is what matters most.", author: "Buddha" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
  ],
  ru: [
    { text: "Будь реалистом: планируй чудо.", author: "Ошо" },
    { text: "Разум — это всё. О чём ты думаешь, тем ты и становишься.", author: "Будда" },
    { text: "Ваше время ограничено, не тратьте его, живя чужой жизнью.", author: "Стив Джобс" },
    { text: "Проживай жизнь во всех возможных формах — хорошее и плохое, горькое и сладкое.", author: "Ошо" },
    { text: "В середине трудности кроется возможность.", author: "Альберт Эйнштейн" },
    { text: "Единственный способ делать великую работу — любить то, что делаешь.", author: "Стив Джобс" },
    { text: "Откажись от идеи стать кем-то, ведь ты уже шедевр.", author: "Ошо" },
    { text: "Покой приходит изнутри. Не ищи его снаружи.", author: "Будда" },
    { text: "Секрет успеха — начать действовать.", author: "Марк Твен" },
    { text: "Креативность — это величайший бунт в существовании.", author: "Ошо" },
    { text: "Здоровье — величайший дар, удовлетворённость — величайшее богатство.", author: "Будда" },
    { text: "Не считай дни, а делай так, чтобы каждый день считался.", author: "Мухаммед Али" },
    { text: "Если вы родитель, откройте ребёнку двери в неизвестные направления.", author: "Ошо" },
    { text: "Три вещи нельзя долго скрывать: солнце, луну и истину.", author: "Будда" },
    { text: "Успех не окончателен, неудача не смертельна: важна смелость продолжать.", author: "Уинстон Черчилль" },
    { text: "Грусть даёт глубину. Счастье даёт высоту. Грусть даёт корни. Счастье даёт ветви.", author: "Ошо" },
    { text: "Вы не будете наказаны за свой гнев, вы будете наказаны своим гневом.", author: "Будда" },
    { text: "Лучшее время посадить дерево было 20 лет назад. Второе лучшее — сейчас.", author: "Китайская пословица" },
    { text: "Жизнь начинается там, где заканчивается страх.", author: "Ошо" },
    { text: "Не живи в прошлом, не мечтай о будущем, сосредоточь ум на настоящем.", author: "Будда" },
    { text: "Неважно, как медленно ты идёшь, пока ты не останавливаешься.", author: "Конфуций" },
    { text: "Мужество — это не отсутствие страха, а понимание, что есть нечто важнее.", author: "Ошо" },
    { text: "О чём мы думаем, тем мы становимся.", author: "Будда" },
    { text: "Действие — фундаментальный ключ ко всему успеху.", author: "Пабло Пикассо" },
    { text: "Способность быть одному — это способность любить.", author: "Ошо" },
    { text: "Идея, воплощённая в действие, важнее идеи, существующей только как идея.", author: "Будда" },
    { text: "Верь, что можешь, и ты уже на полпути.", author: "Теодор Рузвельт" },
    { text: "Интеллект — это способность адаптироваться к переменам.", author: "Стивен Хокинг" },
    { text: "Быть креативным — значит быть влюблённым в жизнь.", author: "Ошо" },
    { text: "Каждое утро мы рождаемся заново. То, что мы делаем сегодня — самое важное.", author: "Будда" },
    { text: "Единственное невозможное путешествие — то, которое ты так и не начал.", author: "Тони Роббинс" },
  ],
};

export function getDailyQuote(language: "en" | "ru") {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const list = quotes[language];
  const index = dayOfYear % list.length;
  return list[index];
}
