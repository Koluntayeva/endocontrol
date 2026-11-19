'use strict';
/* "Diabetes school": short lessons with a mini quiz. Russian and English; other languages
   fall back to Russian (Kazakh) or English. Figures follow ISPAD / ADA consensus guidance.
   Lesson ids are shared across languages: progress is stored per id. */
(function () {
  const ru = [
    {
      id: 'basics', icon: '🌱', min: 4,
      title: 'Что такое диабет 1 типа',
      summary: 'Почему не хватает инсулина и почему в этом никто не виноват.',
      sections: [
        { h: 'Что происходит в организме', p: ['Поджелудочная железа вырабатывает инсулин — гормон, который помогает глюкозе из еды попасть в клетки и дать им энергию.', 'При диабете 1 типа иммунная система по ошибке разрушает клетки, производящие инсулин. Без инсулина глюкоза остаётся в крови, и сахар крови растёт.'] },
        { h: 'Чем он не вызван', list: ['Диабет 1 типа не возникает из-за сладкого или «неправильного» питания.', 'Им нельзя заразиться.', 'Родители не виноваты: это аутоиммунное заболевание.'] },
        { h: 'Что это значит для жизни', p: ['Инсулин нужно вводить каждый день — уколами или помпой. Таблетки при 1 типе инсулин не заменяют.', 'С хорошим контролем дети и взрослые с диабетом учатся, занимаются спортом, путешествуют и живут полной жизнью.'] },
      ],
      quiz: [
        { q: 'Почему при диабете 1 типа растёт сахар крови?', a: ['Человек ест много сладкого', 'Организм почти не вырабатывает инсулин', 'Не хватает витаминов'], ok: 1, why: 'Иммунная система разрушает клетки, которые производят инсулин.' },
        { q: 'Можно ли лечить диабет 1 типа только таблетками?', a: ['Да', 'Нет, нужен инсулин'], ok: 1, why: 'При 1 типе инсулин жизненно необходим каждый день.' },
      ],
    },
    {
      id: 'targets', icon: '🎯', min: 5,
      title: 'Сахар крови и цели',
      summary: 'Ммоль/л и мг/дл, целевой диапазон, время в диапазоне и HbA1c.',
      sections: [
        { h: 'Единицы', p: ['Сахар измеряют в ммоль/л или мг/дл. 1 ммоль/л ≈ 18 мг/дл: 5,5 ммоль/л = 100 мг/дл, 10 ммоль/л = 180 мг/дл.'] },
        { h: 'Целевой диапазон', list: ['Обычная цель — 3,9–10,0 ммоль/л (70–180 мг/дл). Личные цели назначает врач.', 'Время в диапазоне (TIR) — больше 70% суток.', 'Ниже 3,9 ммоль/л — меньше 4% времени, ниже 3,0 ммоль/л — меньше 1%.', 'Выше 10,0 ммоль/л — меньше 25% времени.'] },
        { h: 'HbA1c и GMI', p: ['Гликированный гемоглобин (HbA1c) показывает средний сахар за 2–3 месяца. Частая цель для детей и взрослых — 7% и ниже.', 'GMI в отчётах приложения — оценка HbA1c по данным датчика. Она может отличаться от анализа крови.'] },
      ],
      quiz: [
        { q: 'Какая обычная цель времени в диапазоне?', a: ['Больше 50%', 'Больше 70%', '100%'], ok: 1, why: 'Международный консенсус: TIR больше 70%, при этом гипо меньше 4%.' },
        { q: '10 ммоль/л — это примерно сколько мг/дл?', a: ['100', '180', '250'], ok: 1, why: '10 × 18 = 180 мг/дл.' },
      ],
    },
    {
      id: 'cgm', icon: '📡', min: 4,
      title: 'Датчики глюкозы (CGM)',
      summary: 'Как работает датчик, стрелки тренда и когда проверять глюкометром.',
      sections: [
        { h: 'Как это работает', p: ['Датчик измеряет глюкозу в межклеточной жидкости под кожей каждые 1–5 минут. Она отстаёт от крови примерно на 5–15 минут, особенно когда сахар быстро меняется.'] },
        { h: 'Стрелки тренда', list: ['→ сахар стабилен.', '↗ или ↘ меняется примерно на 0,06–0,1 ммоль/л в минуту.', '↑ или ↓ быстро растёт или падает: будьте внимательны.'] },
        { h: 'Когда проверить глюкометром', list: ['Самочувствие не совпадает с показаниями датчика.', 'В первые сутки после установки нового датчика.', 'Перед важным решением о лечении гипо или коррекции, если так советует врач.'] },
        { h: 'Сигналы', p: ['Настройте сигналы низкого и высокого сахара в приложении датчика. Ночные сигналы особенно важны для детей.'] },
      ],
      quiz: [
        { q: 'Почему датчик может показывать не то же, что глюкометр?', a: ['Датчик сломан', 'Датчик отстаёт от крови на 5–15 минут', 'Глюкометр всегда ошибается'], ok: 1, why: 'Датчик измеряет межклеточную жидкость, она отстаёт от крови.' },
        { q: 'Что значит стрелка ↓?', a: ['Сахар быстро падает', 'Сахар стабилен', 'Датчик разряжен'], ok: 0, why: 'Двойная или прямая стрелка вниз — быстрое падение.' },
      ],
    },
    {
      id: 'insulin', icon: '💉', min: 6,
      title: 'Инсулин',
      summary: 'Базальный и болюсный инсулин, места уколов и хранение.',
      sections: [
        { h: 'Два вида инсулина', list: ['Базальный (длинный) работает весь день и держит сахар между едой и ночью.', 'Болюсный (короткий или ультракороткий) вводят на еду и для коррекции высокого сахара.', 'Помпа подаёт ультракороткий инсулин и как базальный, и как болюс.'] },
        { h: 'Когда вводить на еду', p: ['Ультракороткий инсулин обычно вводят за 10–15 минут до еды. Точное время и дозы назначает врач — не меняйте их самостоятельно.'] },
        { h: 'Места уколов', p: ['Живот, бёдра, ягодицы, плечи. Меняйте место каждый раз: в одном месте появляются уплотнения (липогипертрофия), из которых инсулин всасывается непредсказуемо.'] },
        { h: 'Хранение', list: ['Запас — в холодильнике при 2–8 °C, не в морозилке.', 'Начатую ручку можно хранить при комнатной температуре до 4 недель (смотрите инструкцию).', 'Не оставляйте инсулин на солнце, в машине или у батареи. Замёрзший или мутный (если должен быть прозрачным) — не используйте.'] },
      ],
      quiz: [
        { q: 'Зачем менять места уколов?', a: ['Чтобы не было уплотнений и инсулин работал предсказуемо', 'Так меньше расход инсулина', 'Это не нужно'], ok: 0, why: 'Липогипертрофия нарушает всасывание инсулина.' },
        { q: 'Где хранить запас инсулина?', a: ['В морозилке', 'В холодильнике при 2–8 °C', 'На подоконнике'], ok: 1, why: 'Замороженный инсулин теряет активность.' },
      ],
    },
    {
      id: 'carbs', icon: '🍞', min: 5,
      title: 'Углеводы и хлебные единицы',
      summary: 'Что сильнее всего повышает сахар и как считать углеводы.',
      sections: [
        { h: 'Что повышает сахар', p: ['Сильнее всего сахар повышают углеводы: хлеб, крупы, картофель, фрукты, сладости, сладкие напитки, молоко. Белки и жиры влияют меньше и позже, но жирная еда может поднять сахар через 3–5 часов.'] },
        { h: 'Как считать', list: ['Смотрите на упаковке «углеводы на 100 г» и пересчитайте на свою порцию.', '1 хлебная единица (ХЕ) = 10–12 г углеводов (уточните у врача, какую считаете вы).', 'Кухонные весы и таблицы ХЕ помогают в первые месяцы.', 'Записывайте углеводы в дневник приложения: так врач увидит связь еды и сахара.'] },
        { h: 'Быстрые и медленные', p: ['Сок, сладкие напитки и белый хлеб поднимают сахар быстро. Цельнозерновые продукты и овощи — медленнее. Быстрые углеводы нужны для лечения гипогликемии.'] },
      ],
      quiz: [
        { q: 'Сколько граммов углеводов в 1 ХЕ?', a: ['1–2 г', '10–12 г', '50 г'], ok: 1, why: 'Обычно 1 ХЕ = 10 или 12 г углеводов.' },
        { q: 'Что быстрее поднимет сахар?', a: ['Сок', 'Кусок сыра', 'Огурец'], ok: 0, why: 'В соке быстрые углеводы.' },
      ],
    },
    {
      id: 'hypo', icon: '🍬', min: 6,
      title: 'Гипогликемия (низкий сахар)',
      summary: 'Признаки, правило 15 и что делать при тяжёлой гипо.',
      sections: [
        { h: 'Что это', p: ['Гипогликемия — сахар ниже 3,9 ммоль/л (70 мг/дл). Ниже 3,0 ммоль/л — значимая гипо, её нужно лечить сразу.'] },
        { h: 'Признаки', list: ['Дрожь, потливость, бледность, голод, сердцебиение.', 'Раздражительность, плач, странное поведение у детей.', 'Слабость, головокружение, спутанность, нечёткая речь.', 'Ночью: кошмары, мокрая от пота подушка, утренняя головная боль.'] },
        { h: 'Правило 15', list: ['Дайте 15 г быстрых углеводов: 150 мл сока, 3–4 таблетки глюкозы или 1 столовую ложку сахара в воде. Детям — по плану врача (часто 0,3 г на кг веса).', 'Через 15 минут проверьте сахар.', 'Если он всё ещё ниже 3,9 ммоль/л — повторите.', 'Когда сахар выше 3,9 и до еды далеко — съешьте медленные углеводы (хлеб, печенье).'] },
        { h: 'Тяжёлая гипогликемия', p: ['Если человек без сознания, у него судороги или он не может глотать: ничего не давайте в рот, уложите на бок, введите глюкагон (укол или назальный спрей, если есть) и вызовите скорую — 103 или 112.', 'Глюкагон должен быть всегда под рукой, а близкие и учителя — знать, как его применять.'] },
      ],
      quiz: [
        { q: 'Сахар 3,2 ммоль/л. Что делать сначала?', a: ['Ввести инсулин', 'Дать 15 г быстрых углеводов', 'Подождать час'], ok: 1, why: 'Сначала быстрые углеводы, через 15 минут — проверить сахар.' },
        { q: 'Человек без сознания при гипо. Что нельзя делать?', a: ['Вызывать скорую', 'Вливать сок в рот', 'Вводить глюкагон'], ok: 1, why: 'Без сознания он может захлебнуться: только глюкагон и скорая.' },
      ],
    },
    {
      id: 'glucagon', img: 'l-hypo', icon: '💉', min: 6,
      title: 'Глюкагон: спасение при тяжёлой гипо',
      summary: 'Когда нужен, какие бывают формы, дозы и как вводить.',
      sections: [
        { h: 'Что это и когда нужен', p: ['Глюкагон — гормон, который заставляет печень быстро выбросить глюкозу в кровь. Его вводят при тяжёлой гипогликемии, когда человек без сознания, у него судороги или он не может безопасно глотать. Сладкое в рот в этот момент давать нельзя — можно захлебнуться.'] },
        { h: 'Формы и дозы', list: ['Набор для укола (ГлюкаГен ГипоКит и аналоги): порошок + растворитель в шприце. Детям до 25 кг (или младше 6–8 лет) — 0,5 мг (половина), от 25 кг и взрослым — 1 мг (весь шприц).', 'Назальный глюкагон (Баксими): 3 мг в одну ноздрю, от 4 лет; вдыхать не нужно, работает и при насморке.', 'Готовые шприц-ручки (Gvoke, Зегалог) — по инструкции. Какая форма доступна в вашей стране — уточните у врача и в аптеке.'] },
        { h: 'Как ввести укол', list: ['Введите растворитель в флакон с порошком, покачайте до прозрачности и наберите нужную дозу обратно.', 'Уколите в бедро, плечо или ягодицу — под кожу или в мышцу, можно через одежду.', 'Уложите человека на бок: после глюкагона часто бывает рвота.', 'Вызовите скорую (103 или 112).'] },
        { h: 'После введения', p: ['Обычно человек приходит в себя через 10–15 минут. Как только сможет глотать — дайте сок или сахар, затем медленные углеводы: действие глюкагона короткое, сахар может снова упасть.', 'Если через 15 минут не стало лучше — ждите скорую, вторую дозу вводят только по указанию врача. Глюкагон хуже работает после долгого голодания и алкоголя.'] },
        { h: 'Практические советы', list: ['Глюкагон всегда должен быть рядом: дома, в школе, в поездках, в спортивной сумке.', 'Научите родных, учителей, тренера: покажите набор и потренируйтесь на учебном.', 'Проверяйте срок годности; храните по инструкции (ГлюкаГен — при комнатной температуре до 25 °C или в холодильнике, не замораживать).', 'После любого применения глюкагона сообщите эндокринологу — нужно разобраться в причине.', 'При болезни с рвотой врач иногда назначает «мини-дозы» глюкагона, чтобы предотвратить гипо, — только по его схеме.'] },
      ],
      quiz: [
        { q: 'Ребёнок весом 20 кг без сознания из-за гипо. Какая доза ГлюкаГена?', a: ['0,5 мг', '1 мг', '2 мг'], ok: 0, why: 'Детям до 25 кг — 0,5 мг, от 25 кг и взрослым — 1 мг.' },
        { q: 'Что сделать сразу после укола глюкагона?', a: ['Дать сок, пока без сознания', 'Уложить на бок и вызвать скорую', 'Ввести инсулин'], ok: 1, why: 'Без сознания ничего в рот; на бок — из-за возможной рвоты; скорая — обязательно.' },
      ],
    },
    {
      id: 'hyper', icon: '🔥', min: 6,
      title: 'Высокий сахар и кетоны',
      summary: 'Когда проверять кетоны и как распознать кетоацидоз.',
      sections: [
        { h: 'Почему сахар высокий', list: ['Пропущен или недостаточен инсулин, перебит учёт углеводов.', 'Болезнь, стресс, гормоны, рост.', 'Помпа: перегиб или выпадение катетера, испорченный инсулин.'] },
        { h: 'Когда проверять кетоны', p: ['Если сахар выше 13,9 ммоль/л (250 мг/дл) больше 1–2 часов, при болезни, тошноте или рвоте. Кетоны в крови:'], list: ['ниже 0,6 ммоль/л — норма;', '0,6–1,5 — повышены: действуйте по плану врача, пейте воду;', '1,5–3,0 — высокий риск: срочно свяжитесь с врачом;', 'выше 3,0 — опасно, нужна неотложная помощь.'] },
        { h: 'Признаки кетоацидоза (ДКА)', p: ['Тошнота, рвота, боль в животе, запах ацетона изо рта, глубокое частое дыхание, сонливость. Это угрожает жизни: вызывайте скорую 103 или 112.'] },
      ],
      quiz: [
        { q: 'Сахар 15 ммоль/л уже 2 часа. Что проверить?', a: ['Кетоны', 'Давление', 'Ничего'], ok: 0, why: 'При сахаре выше 13,9 больше 1–2 часов проверяют кетоны.' },
        { q: 'Кетоны крови 3,5 ммоль/л и рвота. Что делать?', a: ['Лечь спать', 'Срочно обратиться за неотложной помощью', 'Выпить сок'], ok: 1, why: 'Это признаки кетоацидоза — нужна скорая.' },
      ],
    },
    {
      id: 'sport', icon: '⚽', min: 4,
      title: 'Спорт и активность',
      summary: 'Как заниматься спортом без гипо.',
      sections: [
        { h: 'Перед тренировкой', list: ['Проверьте сахар. Если он ниже 5–7 ммоль/л — съешьте 10–20 г углеводов (уточните цифры с врачом).', 'Если сахар высокий и есть кетоны — тренировку отложите.', 'Возьмите с собой быстрые углеводы и глюкометр.'] },
        { h: 'Во время и после', p: ['Длительная нагрузка снижает сахар. После спорта он может упасть позже — через несколько часов и даже ночью. Смотрите на график и сигналы датчика вечером.', 'Интенсивные короткие нагрузки (спринт, соревнования) иногда временно поднимают сахар.'] },
      ],
      quiz: [
        { q: 'Когда после футбола может случиться гипо?', a: ['Только во время игры', 'Через несколько часов и даже ночью', 'Никогда'], ok: 1, why: 'Отсроченная гипогликемия бывает до 24 часов после нагрузки.' },
        { q: 'Сахар высокий и кетоны повышены. Тренироваться?', a: ['Да, сахар снизится', 'Нет, отложить'], ok: 1, why: 'Нагрузка при кетонах может ухудшить состояние.' },
      ],
    },
    {
      id: 'sick', icon: '🤒', min: 4,
      title: 'Дни болезни',
      summary: 'Простуда, температура, рвота: правила на время болезни.',
      sections: [
        { h: 'Главные правила', list: ['Никогда не отменяйте базальный инсулин, даже если человек не ест.', 'Проверяйте сахар каждые 2–4 часа, а кетоны — при сахаре выше 13,9 ммоль/л.', 'Пейте больше жидкости: воду, а при низком сахаре — напитки с сахаром.', 'Дозы на время болезни меняют по плану врача.'] },
        { h: 'Когда срочно к врачу', list: ['Рвота больше одного раза или ребёнок не может пить.', 'Кетоны крови выше 1,5 ммоль/л или растут.', 'Боль в животе, тяжёлое дыхание, сонливость.', 'Сахар не снижается или повторяются гипо.'] },
      ],
      quiz: [
        { q: 'Ребёнок заболел и не ест. Базальный инсулин…', a: ['отменить', 'продолжать, дозу обсудить с врачом'], ok: 1, why: 'Без базального инсулина быстро растут кетоны.' },
        { q: 'Как часто проверять сахар при болезни?', a: ['Раз в день', 'Каждые 2–4 часа'], ok: 1, why: 'Болезнь быстро меняет потребность в инсулине.' },
      ],
    },
    {
      id: 'life', icon: '🎒', min: 5,
      title: 'Школа, поездки и поддержка',
      summary: 'Детский сад и школа, путешествия, эмоции и выгорание.',
      sections: [
        { h: 'Школа и детский сад', list: ['Составьте с врачом письменный план: цели сахара, как лечить гипо, кому звонить.', 'Учитель и медсестра должны знать признаки гипо и где лежат быстрые углеводы и глюкагон.', 'Ребёнку можно есть и проверять сахар на уроке — это не нарушение.', 'Доступ к графику в приложении поможет родителям видеть сахар удалённо.'] },
        { h: 'Поездки', list: ['Инсулин и расходники — в ручную кладь, с двойным запасом.', 'Возьмите справку от врача на английском для перелётов.', 'При смене часовых поясов заранее обсудите с врачом время базального инсулина.'] },
        { h: 'Эмоции', p: ['Диабет — это много ежедневных решений. Усталость, злость и «выгорание» бывают у детей и родителей. Говорите о них с врачом и психологом, найдите сообщество семей с диабетом.'] },
      ],
      quiz: [
        { q: 'Где везти инсулин в самолёте?', a: ['В багаже', 'В ручной клади'], ok: 1, why: 'В багажном отсеке инсулин может замёрзнуть или потеряться.' },
        { q: 'Кто в школе должен знать признаки гипо?', a: ['Только ребёнок', 'Учитель и школьная медсестра'], ok: 1, why: 'Ребёнок при гипо может не суметь помочь себе сам.' },
      ],
    },
  ];

  const en = [
    {
      id: 'basics', icon: '🌱', min: 4,
      title: 'What type 1 diabetes is',
      summary: 'Why insulin runs short, and why nobody is to blame.',
      sections: [
        { h: 'What happens in the body', p: ['The pancreas makes insulin, a hormone that lets glucose from food enter the cells and give them energy.', 'In type 1 diabetes the immune system destroys the insulin-making cells by mistake. Without insulin, glucose stays in the blood and blood glucose rises.'] },
        { h: 'What does not cause it', list: ['Type 1 diabetes is not caused by sweets or a "wrong" diet.', 'It is not contagious.', 'Parents are not to blame: it is an autoimmune disease.'] },
        { h: 'What it means for life', p: ['Insulin is needed every day, by injections or a pump. In type 1, tablets do not replace insulin.', 'With good management, children and adults with diabetes study, play sports, travel and live full lives.'] },
      ],
      quiz: [
        { q: 'Why does blood glucose rise in type 1 diabetes?', a: ['Eating too many sweets', 'The body makes almost no insulin', 'A lack of vitamins'], ok: 1, why: 'The immune system destroys the insulin-making cells.' },
        { q: 'Can type 1 diabetes be treated with tablets alone?', a: ['Yes', 'No, insulin is needed'], ok: 1, why: 'In type 1, insulin is vital every day.' },
      ],
    },
    {
      id: 'targets', icon: '🎯', min: 5,
      title: 'Glucose and targets',
      summary: 'mmol/L and mg/dL, target range, time in range and HbA1c.',
      sections: [
        { h: 'Units', p: ['Glucose is measured in mmol/L or mg/dL. 1 mmol/L ≈ 18 mg/dL: 5.5 mmol/L = 100 mg/dL, 10 mmol/L = 180 mg/dL.'] },
        { h: 'Target range', list: ['The usual target is 3.9–10.0 mmol/L (70–180 mg/dL). Your doctor sets personal targets.', 'Time in range (TIR): more than 70% of the day.', 'Below 3.9 mmol/L: less than 4% of the time; below 3.0 mmol/L: less than 1%.', 'Above 10.0 mmol/L: less than 25% of the time.'] },
        { h: 'HbA1c and GMI', p: ['HbA1c shows average glucose over 2–3 months. A common target for children and adults is 7% or lower.', 'GMI in the app reports estimates HbA1c from sensor data. It may differ from the lab test.'] },
      ],
      quiz: [
        { q: 'What is the usual time-in-range goal?', a: ['More than 50%', 'More than 70%', '100%'], ok: 1, why: 'International consensus: TIR above 70% with lows under 4%.' },
        { q: 'About how many mg/dL is 10 mmol/L?', a: ['100', '180', '250'], ok: 1, why: '10 × 18 = 180 mg/dL.' },
      ],
    },
    {
      id: 'cgm', icon: '📡', min: 4,
      title: 'Glucose sensors (CGM)',
      summary: 'How a sensor works, trend arrows and when to check with a meter.',
      sections: [
        { h: 'How it works', p: ['The sensor measures glucose in the fluid under the skin every 1–5 minutes. It lags blood by about 5–15 minutes, especially when glucose changes fast.'] },
        { h: 'Trend arrows', list: ['→ glucose is steady.', '↗ or ↘ changing by about 1–2 mg/dL per minute.', '↑ or ↓ rising or falling fast: pay attention.'] },
        { h: 'When to use a meter', list: ['How you feel does not match the sensor.', 'During the first day of a new sensor.', 'Before an important treatment decision, if your doctor advises it.'] },
        { h: 'Alarms', p: ['Set low and high alarms in the sensor app. Night alarms matter most for children.'] },
      ],
      quiz: [
        { q: 'Why may the sensor differ from the meter?', a: ['The sensor is broken', 'The sensor lags blood by 5–15 minutes', 'Meters are always wrong'], ok: 1, why: 'The sensor reads fluid under the skin, which lags blood.' },
        { q: 'What does ↓ mean?', a: ['Glucose is falling fast', 'Glucose is steady', 'The sensor battery is low'], ok: 0, why: 'A straight or double down arrow means a fast fall.' },
      ],
    },
    {
      id: 'insulin', icon: '💉', min: 6,
      title: 'Insulin',
      summary: 'Basal and bolus insulin, injection sites and storage.',
      sections: [
        { h: 'Two kinds of insulin', list: ['Basal (long-acting) works all day and holds glucose between meals and at night.', 'Bolus (rapid-acting) is taken for meals and to correct high glucose.', 'A pump delivers rapid-acting insulin both as basal and as boluses.'] },
        { h: 'When to inject for meals', p: ['Rapid-acting insulin is usually given 10–15 minutes before eating. Your doctor sets the timing and doses — do not change them on your own.'] },
        { h: 'Injection sites', p: ['Belly, thighs, buttocks, upper arms. Rotate every time: injecting in one spot causes lumps (lipohypertrophy) that absorb insulin unpredictably.'] },
        { h: 'Storage', list: ['Keep spare insulin in the fridge at 2–8 °C, never in the freezer.', 'An opened pen can stay at room temperature for up to 4 weeks (check the leaflet).', 'Keep insulin out of the sun, hot cars and away from heaters. Do not use it if it froze or turned cloudy when it should be clear.'] },
      ],
      quiz: [
        { q: 'Why rotate injection sites?', a: ['To avoid lumps so insulin works predictably', 'To use less insulin', 'There is no need'], ok: 0, why: 'Lipohypertrophy disturbs insulin absorption.' },
        { q: 'Where should spare insulin be stored?', a: ['In the freezer', 'In the fridge at 2–8 °C', 'On a windowsill'], ok: 1, why: 'Frozen insulin loses its effect.' },
      ],
    },
    {
      id: 'carbs', icon: '🍞', min: 5,
      title: 'Carbohydrates and carb counting',
      summary: 'What raises glucose most and how to count carbs.',
      sections: [
        { h: 'What raises glucose', p: ['Carbohydrates raise glucose most: bread, grains, potatoes, fruit, sweets, sugary drinks, milk. Protein and fat matter less and later, but a fatty meal can raise glucose 3–5 hours afterwards.'] },
        { h: 'How to count', list: ['Read "carbohydrate per 100 g" on the label and scale it to your portion.', 'Some countries use bread units: 1 unit = 10–12 g of carbs.', 'Kitchen scales and carb tables help in the first months.', 'Log carbs in the app diary so the doctor can see how food affects glucose.'] },
        { h: 'Fast and slow', p: ['Juice, sugary drinks and white bread raise glucose fast. Whole grains and vegetables act slower. Fast carbs are what you need to treat a low.'] },
      ],
      quiz: [
        { q: 'How many grams of carbs are in 1 bread unit?', a: ['1–2 g', '10–12 g', '50 g'], ok: 1, why: 'One bread unit is usually 10 or 12 g of carbs.' },
        { q: 'What raises glucose faster?', a: ['Juice', 'A piece of cheese', 'A cucumber'], ok: 0, why: 'Juice contains fast carbs.' },
      ],
    },
    {
      id: 'hypo', icon: '🍬', min: 6,
      title: 'Hypoglycaemia (low glucose)',
      summary: 'Signs, the rule of 15 and what to do in a severe low.',
      sections: [
        { h: 'What it is', p: ['Hypoglycaemia is glucose below 3.9 mmol/L (70 mg/dL). Below 3.0 mmol/L (54 mg/dL) is a significant low that must be treated at once.'] },
        { h: 'Signs', list: ['Shaking, sweating, pale skin, hunger, a racing heart.', 'Irritability, crying or odd behaviour in children.', 'Weakness, dizziness, confusion, slurred speech.', 'At night: nightmares, a sweaty pillow, a headache in the morning.'] },
        { h: 'The rule of 15', list: ['Take 15 g of fast carbs: 150 ml of juice, 3–4 glucose tablets or a tablespoon of sugar in water. For children follow the doctor\'s plan (often 0.3 g per kg).', 'Check glucose after 15 minutes.', 'If it is still below 3.9 mmol/L, repeat.', 'Once above 3.9 and the next meal is far off, eat slow carbs (bread, crackers).'] },
        { h: 'Severe hypoglycaemia', p: ['If the person is unconscious, having a seizure or cannot swallow: give nothing by mouth, turn them on their side, give glucagon (injection or nasal spray, if available) and call emergency services.', 'Keep glucagon at hand, and make sure family and teachers know how to use it.'] },
      ],
      quiz: [
        { q: 'Glucose is 3.2 mmol/L. What comes first?', a: ['Inject insulin', 'Take 15 g of fast carbs', 'Wait an hour'], ok: 1, why: 'Fast carbs first, then check again after 15 minutes.' },
        { q: 'Someone is unconscious from a low. What must you not do?', a: ['Call an ambulance', 'Pour juice into their mouth', 'Give glucagon'], ok: 1, why: 'They could choke: only glucagon and emergency help.' },
      ],
    },
    {
      id: 'glucagon', img: 'l-hypo', icon: '💉', min: 6,
      title: 'Glucagon: rescue in a severe low',
      summary: 'When it is needed, the forms, doses and how to give it.',
      sections: [
        { h: 'What it is and when to use it', p: ['Glucagon is a hormone that makes the liver release glucose into the blood quickly. It is given in severe hypoglycaemia, when the person is unconscious, having a seizure or cannot swallow safely. Do not put anything sweet in their mouth then — they could choke.'] },
        { h: 'Forms and doses', list: ['Injection kit (GlucaGen HypoKit and similar): powder plus solvent in a syringe. Children under 25 kg (or younger than 6–8 years) — 0.5 mg (half), from 25 kg and adults — 1 mg (the whole syringe).', 'Nasal glucagon (Baqsimi): 3 mg into one nostril, from 4 years; no need to sniff, works with a blocked nose.', 'Ready-to-use pens (Gvoke, Zegalogue) — follow the leaflet. Ask your doctor and pharmacy which forms are available where you live.'] },
        { h: 'Giving the injection', list: ['Inject the solvent into the powder vial, swirl until clear and draw the dose back up.', 'Inject into the thigh, upper arm or buttock — under the skin or into the muscle, even through clothing.', 'Turn the person on their side: vomiting after glucagon is common.', 'Call emergency services.'] },
        { h: 'Afterwards', p: ['Most people wake up in 10–15 minutes. As soon as they can swallow, give juice or sugar, then slow carbs: glucagon works only briefly and glucose can fall again.', 'If there is no improvement after 15 minutes, wait for the ambulance; a second dose is given only on medical advice. Glucagon works less well after long fasting and alcohol.'] },
        { h: 'Practical tips', list: ['Keep glucagon close: at home, at school, when travelling, in the sports bag.', 'Teach family, teachers and coaches: show them the kit and practise with a trainer.', 'Check the expiry date; store as the leaflet says (GlucaGen at room temperature up to 25 °C or in the fridge, never frozen).', 'Tell the endocrinologist after every use of glucagon — the cause needs looking into.', 'During illness with vomiting a doctor sometimes prescribes "mini-doses" of glucagon to prevent lows — only on their schedule.'] },
      ],
      quiz: [
        { q: 'A 20 kg child is unconscious from a low. Which GlucaGen dose?', a: ['0.5 mg', '1 mg', '2 mg'], ok: 0, why: 'Under 25 kg — 0.5 mg; from 25 kg and adults — 1 mg.' },
        { q: 'What comes right after the glucagon injection?', a: ['Juice while still unconscious', 'Turn on the side and call an ambulance', 'Inject insulin'], ok: 1, why: 'Nothing by mouth while unconscious; on the side in case of vomiting; always call an ambulance.' },
      ],
    },
    {
      id: 'hyper', icon: '🔥', min: 6,
      title: 'High glucose and ketones',
      summary: 'When to check ketones and how to spot DKA.',
      sections: [
        { h: 'Why glucose runs high', list: ['Missed or too little insulin, carbs miscounted.', 'Illness, stress, hormones, growth.', 'Pump: a kinked or dislodged cannula, spoiled insulin.'] },
        { h: 'When to check ketones', p: ['When glucose stays above 13.9 mmol/L (250 mg/dL) for more than 1–2 hours, and during illness, nausea or vomiting. Blood ketones:'], list: ['below 0.6 mmol/L — normal;', '0.6–1.5 — raised: follow your doctor\'s plan, drink water;', '1.5–3.0 — high risk: contact your doctor now;', 'above 3.0 — dangerous, needs emergency care.'] },
        { h: 'Signs of DKA', p: ['Nausea, vomiting, stomach pain, fruity breath, deep fast breathing, drowsiness. This is life-threatening: call emergency services.'] },
      ],
      quiz: [
        { q: 'Glucose has been 15 mmol/L for 2 hours. What to check?', a: ['Ketones', 'Blood pressure', 'Nothing'], ok: 0, why: 'Check ketones when glucose stays above 13.9 for 1–2 hours.' },
        { q: 'Blood ketones are 3.5 mmol/L with vomiting. What to do?', a: ['Go to sleep', 'Get emergency care now', 'Drink juice'], ok: 1, why: 'These are signs of DKA — call an ambulance.' },
      ],
    },
    {
      id: 'sport', icon: '⚽', min: 4,
      title: 'Sport and activity',
      summary: 'How to be active without lows.',
      sections: [
        { h: 'Before exercise', list: ['Check glucose. If it is below 5–7 mmol/L (90–125 mg/dL), eat 10–20 g of carbs (confirm numbers with your doctor).', 'If glucose is high and ketones are present, postpone exercise.', 'Carry fast carbs and a meter.'] },
        { h: 'During and after', p: ['Long activity lowers glucose. It can drop later too — hours afterwards and even at night. Watch the chart and sensor alarms in the evening.', 'Short intense efforts (sprints, competitions) sometimes raise glucose for a while.'] },
      ],
      quiz: [
        { q: 'When can a low happen after football?', a: ['Only during the game', 'Hours later and even at night', 'Never'], ok: 1, why: 'Delayed lows can occur up to 24 hours after exercise.' },
        { q: 'Glucose is high and ketones are raised. Exercise?', a: ['Yes, glucose will fall', 'No, postpone'], ok: 1, why: 'Exercise with ketones can make things worse.' },
      ],
    },
    {
      id: 'sick', icon: '🤒', min: 4,
      title: 'Sick days',
      summary: 'Colds, fever, vomiting: rules for days of illness.',
      sections: [
        { h: 'Key rules', list: ['Never stop basal insulin, even if not eating.', 'Check glucose every 2–4 hours, and ketones when glucose is above 13.9 mmol/L.', 'Drink plenty: water, or sugary drinks if glucose is low.', 'Doses for sick days follow your doctor\'s plan.'] },
        { h: 'Get help urgently when', list: ['Vomiting more than once, or a child cannot drink.', 'Blood ketones above 1.5 mmol/L or rising.', 'Stomach pain, laboured breathing, drowsiness.', 'Glucose will not come down, or lows keep happening.'] },
      ],
      quiz: [
        { q: 'A child is ill and not eating. Basal insulin should be…', a: ['stopped', 'continued, with the dose discussed with the doctor'], ok: 1, why: 'Without basal insulin ketones rise quickly.' },
        { q: 'How often to check glucose when ill?', a: ['Once a day', 'Every 2–4 hours'], ok: 1, why: 'Illness changes insulin needs fast.' },
      ],
    },
    {
      id: 'life', icon: '🎒', min: 5,
      title: 'School, travel and support',
      summary: 'Nursery and school, travel, emotions and burnout.',
      sections: [
        { h: 'School and nursery', list: ['Make a written plan with your doctor: glucose targets, how to treat lows, whom to call.', 'Teachers and the school nurse should know the signs of a low and where fast carbs and glucagon are kept.', 'A child may eat and check glucose in class — that is not breaking the rules.', 'Sharing the chart from this app lets parents follow glucose remotely.'] },
        { h: 'Travel', list: ['Carry insulin and supplies in hand luggage, with twice what you need.', 'Take a doctor\'s letter for flights.', 'When crossing time zones, agree basal insulin timing with your doctor in advance.'] },
        { h: 'Emotions', p: ['Diabetes means many decisions every day. Tiredness, anger and burnout happen to children and parents alike. Talk about it with your doctor or a psychologist, and find a community of families living with diabetes.'] },
      ],
      quiz: [
        { q: 'Where should insulin travel on a plane?', a: ['In checked baggage', 'In hand luggage'], ok: 1, why: 'In the hold insulin can freeze or get lost.' },
        { q: 'Who at school should know the signs of a low?', a: ['Only the child', 'Teachers and the school nurse'], ok: 1, why: 'During a low a child may be unable to help themselves.' },
      ],
    },
  ];

  const BY_LANG = { ru, en };
  const FALLBACK = { kk: 'ru' };
  window.SCHOOL = {
    lessons(lang) { return BY_LANG[lang] || BY_LANG[FALLBACK[lang]] || en; },
    // Plain text of a lesson, used by the voice assistant's offline answers.
    text(lesson) { return lesson.sections.map(s => [s.h, ...(s.p || []), ...(s.list || [])].join('\n')).join('\n'); },
  };
})();
