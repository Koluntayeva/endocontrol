'use strict';
/* Food list for the diary: available carbohydrates per 100 g of the food as eaten (porridges,
   pasta and grains cooked), from standard food composition tables (Skurikhin / USDA), rounded.
   Home recipes and brands vary: these are guide values, the label on a package wins.
   p: typical portions [grams, Russian, English]. s: extra search words. Shared by browser and server. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Foods = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // [id, ru, en, kk|null, carbs/100 g, category, portions, search words]
  const R = [
    // bread and pastry
    ['bread_white', 'Хлеб белый, батон', 'White bread', 'Ақ нан', 49, 'bread', [[25, '1 ломтик', '1 slice']], 'хлеб батон булка'],
    ['bread_rye', 'Хлеб ржаной (чёрный)', 'Rye bread', 'Қара нан', 40, 'bread', [[30, '1 ломтик', '1 slice']], 'черный бородинский'],
    ['bread_grain', 'Хлеб цельнозерновой', 'Wholegrain bread', null, 41, 'bread', [[30, '1 ломтик', '1 slice']], 'цельнозерновой отрубной'],
    ['lavash', 'Лаваш', 'Lavash flatbread', 'Лаваш', 48, 'bread', [[40, '½ листа', '½ sheet'], [80, '1 лист', '1 sheet']], ''],
    ['lepeshka', 'Лепёшка, тандыр нан', 'Flatbread (tandoor)', 'Тандыр нан', 50, 'bread', [[60, '¼ лепёшки', '¼ flatbread'], [120, '½ лепёшки', '½ flatbread']], 'лепешка нан'],
    ['baursak', 'Баурсак', 'Baursak (fried dough)', 'Бауырсақ', 48, 'bread', [[20, '1 шт', '1 piece'], [100, '5 шт', '5 pieces']], 'баурсаки бауырсак'],
    ['samsa', 'Самса с мясом', 'Samsa (meat pastry)', 'Самса', 30, 'bread', [[120, '1 шт', '1 piece']], 'самса'],
    ['pirozhok', 'Пирожок жареный с мясом', 'Fried meat pie', null, 33, 'bread', [[80, '1 шт', '1 piece']], 'пирожок беляш чебурек'],
    ['blini', 'Блины', 'Crêpes', 'Құймақ', 28, 'bread', [[40, '1 шт', '1 piece'], [120, '3 шт', '3 pieces']], 'блин'],
    ['oladyi', 'Оладьи', 'Pancakes (fritters)', null, 30, 'bread', [[40, '1 шт', '1 piece'], [120, '3 шт', '3 pieces']], 'оладушки панкейк'],
    ['syrniki', 'Сырники', 'Syrniki (cottage cheese pancakes)', null, 18, 'bread', [[50, '1 шт', '1 piece'], [150, '3 шт', '3 pieces']], 'сырник'],
    ['croissant', 'Круассан', 'Croissant', null, 45, 'bread', [[60, '1 шт', '1 piece']], ''],
    ['cookies', 'Печенье сахарное', 'Biscuits (sweet)', 'Печенье', 74, 'bread', [[10, '1 шт', '1 piece'], [50, '5 шт', '5 pieces']], 'печенье'],
    ['crackers', 'Крекеры', 'Crackers', null, 67, 'bread', [[25, '5 шт', '5 pieces']], 'крекер галеты'],
    ['sushki', 'Сушки, баранки', 'Sushki (bread rings)', null, 70, 'bread', [[10, '1 шт', '1 piece']], 'сушка баранка'],
    // grains and sides (cooked)
    ['rice', 'Рис белый варёный', 'White rice, cooked', 'Күріш', 28, 'grains', [[150, 'порция', 'portion'], [100, 'полпорции', 'half portion']], 'рис'],
    ['buckwheat', 'Гречка варёная', 'Buckwheat, cooked', 'Қарақұмық', 20, 'grains', [[150, 'порция', 'portion']], 'гречка гречневая'],
    ['oat_water', 'Овсяная каша на воде', 'Oatmeal with water', 'Сұлы ботқасы', 15, 'grains', [[200, 'тарелка', 'bowl']], 'овсянка геркулес'],
    ['oat_milk', 'Овсяная каша на молоке', 'Oatmeal with milk', null, 14, 'grains', [[200, 'тарелка', 'bowl']], 'овсянка'],
    ['semolina', 'Манная каша на молоке', 'Semolina porridge', null, 15, 'grains', [[200, 'тарелка', 'bowl']], 'манка'],
    ['millet', 'Пшённая каша', 'Millet porridge', 'Тары ботқасы', 25, 'grains', [[150, 'порция', 'portion']], 'пшено'],
    ['pasta', 'Макароны варёные', 'Pasta, cooked', 'Макарон', 25, 'grains', [[150, 'порция', 'portion']], 'макароны спагетти паста лапша вермишель'],
    ['potato', 'Картофель варёный', 'Potato, boiled', 'Картоп', 17, 'grains', [[100, '1 шт', '1 medium'], [200, '2 шт', '2 medium']], 'картошка'],
    ['mash', 'Картофельное пюре', 'Mashed potatoes', 'Картоп пюресі', 14, 'grains', [[150, 'порция', 'portion']], 'пюре'],
    ['potato_fried', 'Картофель жареный', 'Fried potatoes', null, 24, 'grains', [[150, 'порция', 'portion']], 'жареная картошка'],
    ['fries', 'Картофель фри', 'French fries', null, 38, 'grains', [[100, 'малая', 'small'], [150, 'средняя', 'medium']], 'фри'],
    ['bulgur', 'Булгур варёный', 'Bulgur, cooked', null, 19, 'grains', [[150, 'порция', 'portion']], ''],
    ['couscous', 'Кускус варёный', 'Couscous, cooked', null, 23, 'grains', [[150, 'порция', 'portion']], ''],
    ['barley', 'Перловка варёная', 'Pearl barley, cooked', null, 22, 'grains', [[150, 'порция', 'portion']], 'перловая'],
    ['cornflakes', 'Кукурузные хлопья', 'Corn flakes', null, 83, 'grains', [[30, 'порция', 'portion']], 'хлопья завтрак'],
    ['muesli', 'Мюсли', 'Muesli', null, 60, 'grains', [[50, 'порция', 'portion']], 'гранола'],
    // dishes
    ['plov', 'Плов с мясом', 'Plov (pilaf with meat)', 'Палау', 20, 'dishes', [[250, 'порция', 'portion'], [150, 'малая порция', 'small portion']], 'плов палау'],
    ['manty', 'Манты', 'Manty (steamed dumplings)', 'Манты', 20, 'dishes', [[50, '1 шт', '1 piece'], [200, '4 шт', '4 pieces']], 'манты'],
    ['pelmeni', 'Пельмени', 'Pelmeni (dumplings)', 'Тұшпара', 27, 'dishes', [[120, '10 шт', '10 pieces'], [180, '15 шт', '15 pieces']], 'пельмени чучпара тушпара'],
    ['vareniki', 'Вареники с картофелем', 'Vareniki with potato', null, 28, 'dishes', [[150, '10 шт', '10 pieces']], 'вареники'],
    ['beshbarmak', 'Бешбармак', 'Beshbarmak', 'Ет / Бешбармақ', 16, 'dishes', [[300, 'порция', 'portion']], 'бешбармак ет'],
    ['lagman', 'Лагман', 'Lagman (noodles)', 'Лағман', 15, 'dishes', [[350, 'порция', 'portion']], 'лагман'],
    ['kuyrdak', 'Куырдак', 'Kuyrdak', 'Қуырдақ', 6, 'dishes', [[200, 'порция', 'portion']], 'куырдак'],
    ['borsch', 'Борщ', 'Borscht', null, 5, 'dishes', [[300, 'тарелка', 'bowl']], 'борщ'],
    ['chicken_soup', 'Суп куриный с лапшой', 'Chicken noodle soup', 'Кеспе', 5, 'dishes', [[300, 'тарелка', 'bowl']], 'суп лапша кеспе'],
    ['shchi', 'Щи', 'Shchi (cabbage soup)', null, 3, 'dishes', [[300, 'тарелка', 'bowl']], 'щи'],
    ['shorpa', 'Сорпа, шурпа', 'Shorpa (meat broth)', 'Сорпа', 4, 'dishes', [[300, 'тарелка', 'bowl']], 'шурпа сорпа бульон'],
    ['cutlet', 'Котлета мясная', 'Meat patty', null, 9, 'dishes', [[80, '1 шт', '1 piece']], 'котлета'],
    ['omelet', 'Омлет', 'Omelette', null, 2, 'dishes', [[150, 'порция', 'portion']], 'омлет яичница'],
    ['olivier', 'Салат оливье', 'Olivier salad', null, 8, 'dishes', [[150, 'порция', 'portion']], 'оливье'],
    ['vinegret', 'Винегрет', 'Vinegret (beet salad)', null, 8, 'dishes', [[150, 'порция', 'portion']], 'винегрет'],
    ['shawarma', 'Шаурма', 'Shawarma', 'Шаурма', 22, 'dishes', [[300, '1 шт', '1 piece']], 'шаурма донер'],
    ['pizza', 'Пицца', 'Pizza', 'Пицца', 30, 'dishes', [[120, '1 кусок', '1 slice'], [240, '2 куска', '2 slices']], 'пицца'],
    ['burger', 'Бургер', 'Burger', null, 25, 'dishes', [[200, '1 шт', '1 piece']], 'гамбургер чизбургер'],
    ['hotdog', 'Хот-дог', 'Hot dog', null, 24, 'dishes', [[150, '1 шт', '1 piece']], 'хотдог'],
    ['rolls', 'Роллы, суши', 'Sushi rolls', null, 28, 'dishes', [[30, '1 шт', '1 piece'], [240, '8 шт', '8 pieces']], 'суши роллы'],
    // vegetables
    ['cucumber', 'Огурец', 'Cucumber', 'Қияр', 3, 'veg', [[100, '1 шт', '1 medium']], ''],
    ['tomato', 'Помидор', 'Tomato', 'Қызанақ', 4, 'veg', [[120, '1 шт', '1 medium']], 'томат'],
    ['cabbage', 'Капуста', 'Cabbage', 'Қырыққабат', 5, 'veg', [[100, 'порция', 'portion']], ''],
    ['carrot', 'Морковь', 'Carrot', 'Сәбіз', 7, 'veg', [[80, '1 шт', '1 medium']], ''],
    ['beet', 'Свёкла варёная', 'Beetroot, boiled', 'Қызылша', 9, 'veg', [[100, 'порция', 'portion']], 'свекла'],
    ['onion', 'Лук репчатый', 'Onion', 'Пияз', 8, 'veg', [[50, '½ шт', '½ onion']], ''],
    ['pepper', 'Перец сладкий', 'Bell pepper', null, 5, 'veg', [[120, '1 шт', '1 piece']], ''],
    ['zucchini', 'Кабачок', 'Zucchini', null, 4, 'veg', [[150, 'порция', 'portion']], ''],
    ['eggplant', 'Баклажан', 'Aubergine', null, 5, 'veg', [[150, 'порция', 'portion']], ''],
    ['broccoli', 'Брокколи', 'Broccoli', null, 4, 'veg', [[150, 'порция', 'portion']], ''],
    ['corn', 'Кукуруза варёная', 'Sweetcorn, boiled', 'Жүгері', 19, 'veg', [[150, '1 початок', '1 cob'], [100, 'порция', 'portion']], 'кукуруза початок'],
    ['peas', 'Горошек зелёный', 'Green peas', null, 13, 'veg', [[100, 'порция', 'portion']], 'горох'],
    ['beans', 'Фасоль варёная', 'Beans, boiled', null, 16, 'veg', [[150, 'порция', 'portion']], 'фасоль'],
    ['lentils', 'Чечевица варёная', 'Lentils, boiled', null, 14, 'veg', [[150, 'порция', 'portion']], 'чечевица'],
    ['greens', 'Салат листовой, зелень', 'Salad leaves, herbs', null, 2, 'veg', [[50, 'порция', 'portion']], 'зелень салат'],
    // fruit and berries
    ['apple', 'Яблоко', 'Apple', 'Алма', 10, 'fruit', [[150, '1 шт', '1 medium'], [100, 'небольшое', 'small']], 'яблоко'],
    ['banana', 'Банан', 'Banana', 'Банан', 21, 'fruit', [[120, '1 шт', '1 medium']], ''],
    ['pear', 'Груша', 'Pear', 'Алмұрт', 10, 'fruit', [[150, '1 шт', '1 medium']], ''],
    ['orange', 'Апельсин', 'Orange', 'Апельсин', 8, 'fruit', [[150, '1 шт', '1 medium']], ''],
    ['mandarin', 'Мандарин', 'Mandarin', 'Мандарин', 8, 'fruit', [[70, '1 шт', '1 piece']], ''],
    ['grapes', 'Виноград', 'Grapes', 'Жүзім', 16, 'fruit', [[100, 'гроздь', 'bunch']], ''],
    ['watermelon', 'Арбуз', 'Watermelon', 'Қарбыз', 8, 'fruit', [[250, '1 ломоть', '1 slice']], ''],
    ['melon', 'Дыня', 'Melon', 'Қауын', 7, 'fruit', [[200, '1 ломоть', '1 slice']], ''],
    ['strawberry', 'Клубника', 'Strawberries', 'Құлпынай', 7, 'fruit', [[100, 'горсть', 'handful']], 'земляника'],
    ['kiwi', 'Киви', 'Kiwi', null, 10, 'fruit', [[75, '1 шт', '1 piece']], ''],
    ['peach', 'Персик', 'Peach', 'Шабдалы', 10, 'fruit', [[120, '1 шт', '1 piece']], ''],
    ['apricot', 'Абрикос', 'Apricot', 'Өрік', 9, 'fruit', [[40, '1 шт', '1 piece']], ''],
    ['cherry', 'Черешня, вишня', 'Cherries', 'Шие', 11, 'fruit', [[100, 'горсть', 'handful']], 'вишня черешня'],
    ['persimmon', 'Хурма', 'Persimmon', null, 15, 'fruit', [[150, '1 шт', '1 piece']], ''],
    ['pomegranate', 'Гранат', 'Pomegranate', 'Анар', 15, 'fruit', [[100, '½ шт', '½ fruit']], ''],
    ['plum', 'Слива', 'Plum', 'Алхоры', 10, 'fruit', [[30, '1 шт', '1 piece']], ''],
    ['kuraga', 'Курага', 'Dried apricots', 'Кебе өрік', 51, 'fruit', [[30, '5 шт', '5 pieces']], 'курага'],
    ['raisins', 'Изюм', 'Raisins', 'Мейіз', 66, 'fruit', [[15, '1 ст. л.', '1 tbsp']], 'изюм'],
    ['dates', 'Финики', 'Dates', 'Құрма', 69, 'fruit', [[8, '1 шт', '1 piece'], [40, '5 шт', '5 pieces']], ''],
    // dairy
    ['milk', 'Молоко 2,5%', 'Milk', 'Сүт', 4.7, 'dairy', [[200, 'стакан', 'glass']], 'молоко'],
    ['kefir', 'Кефир', 'Kefir', 'Айран-кефир', 4, 'dairy', [[200, 'стакан', 'glass']], ''],
    ['ayran', 'Айран', 'Ayran', 'Айран', 3, 'dairy', [[200, 'стакан', 'glass']], ''],
    ['kumys', 'Кумыс', 'Kumys', 'Қымыз', 5, 'dairy', [[200, 'кесе', 'bowl']], 'кымыз'],
    ['shubat', 'Шубат', 'Shubat (camel milk)', 'Шұбат', 4, 'dairy', [[200, 'кесе', 'bowl']], ''],
    ['yogurt_sweet', 'Йогурт питьевой сладкий', 'Drinking yogurt, sweetened', null, 13, 'dairy', [[250, 'бутылочка', 'bottle']], 'йогурт'],
    ['yogurt_plain', 'Йогурт натуральный', 'Plain yogurt', null, 4, 'dairy', [[125, 'стаканчик', 'pot']], 'йогурт греческий'],
    ['tvorog', 'Творог', 'Cottage cheese (tvorog)', 'Сүзбе', 3, 'dairy', [[100, 'порция', 'portion']], 'творог'],
    ['syrok', 'Сырок глазированный', 'Glazed curd snack', null, 32, 'dairy', [[45, '1 шт', '1 piece']], 'сырок'],
    ['cheese', 'Сыр твёрдый', 'Hard cheese', 'Ірімшік', 0, 'dairy', [[30, '2 ломтика', '2 slices']], 'сыр'],
    ['sour_cream', 'Сметана', 'Sour cream', 'Қаймақ', 3, 'dairy', [[20, '1 ст. л.', '1 tbsp']], ''],
    ['icecream', 'Мороженое пломбир', 'Ice cream', 'Балмұздақ', 21, 'dairy', [[80, 'стаканчик', 'cup']], 'мороженое'],
    // meat, fish, eggs
    ['chicken', 'Курица', 'Chicken', 'Тауық', 0, 'protein', [[150, 'порция', 'portion']], 'курица филе'],
    ['beef', 'Говядина', 'Beef', 'Сиыр еті', 0, 'protein', [[150, 'порция', 'portion']], 'мясо говядина'],
    ['lamb', 'Баранина', 'Lamb', 'Қой еті', 0, 'protein', [[150, 'порция', 'portion']], 'баранина'],
    ['kazy', 'Казы, конина', 'Kazy (horse meat sausage)', 'Қазы', 0, 'protein', [[50, 'несколько ломтиков', 'a few slices']], 'казы карта конина'],
    ['fish', 'Рыба', 'Fish', 'Балық', 0, 'protein', [[150, 'порция', 'portion']], ''],
    ['egg', 'Яйцо', 'Egg', 'Жұмыртқа', 0.7, 'protein', [[55, '1 шт', '1 egg'], [110, '2 шт', '2 eggs']], 'яйца'],
    ['sausage', 'Колбаса варёная', 'Boiled sausage', 'Шұжық', 2, 'protein', [[30, '1 ломтик', '1 slice']], 'колбаса'],
    ['franks', 'Сосиски', 'Frankfurters', null, 2, 'protein', [[50, '1 шт', '1 piece']], 'сосиска сардельки'],
    // sweets
    ['sugar', 'Сахар', 'Sugar', 'Қант', 100, 'sweets', [[5, '1 ч. л.', '1 tsp'], [4, '1 кусочек', '1 cube']], 'сахар'],
    ['honey', 'Мёд', 'Honey', 'Бал', 81, 'sweets', [[10, '1 ч. л.', '1 tsp']], 'мед'],
    ['jam', 'Варенье, джем', 'Jam', 'Тосап', 65, 'sweets', [[20, '1 ст. л.', '1 tbsp']], 'варенье джем'],
    ['choc_milk', 'Шоколад молочный', 'Milk chocolate', 'Шоколад', 57, 'sweets', [[25, '¼ плитки', '¼ bar'], [100, 'плитка', 'bar']], 'шоколад'],
    ['choc_dark', 'Шоколад горький', 'Dark chocolate', null, 48, 'sweets', [[25, '¼ плитки', '¼ bar']], 'шоколад'],
    ['candy', 'Конфета шоколадная', 'Chocolate sweet', 'Кәмпит', 60, 'sweets', [[15, '1 шт', '1 piece']], 'конфета'],
    ['caramel', 'Карамель', 'Hard candy', null, 92, 'sweets', [[5, '1 шт', '1 piece']], 'леденец'],
    ['marshmallow', 'Зефир', 'Zefir (marshmallow)', null, 79, 'sweets', [[35, '1 шт', '1 piece']], 'зефир пастила'],
    ['halva', 'Халва', 'Halva', null, 54, 'sweets', [[30, 'кусочек', 'piece']], ''],
    ['cake', 'Торт', 'Cake', 'Торт', 50, 'sweets', [[100, '1 кусок', '1 slice']], 'торт пирожное'],
    ['waffles', 'Вафли', 'Wafers', null, 65, 'sweets', [[20, '1 шт', '1 piece']], ''],
    ['chakchak', 'Чак-чак', 'Chak-chak', 'Шәкшәк', 62, 'sweets', [[50, 'кусок', 'piece']], 'чакчак'],
    ['glucose_tab', 'Таблетка глюкозы', 'Glucose tablet', 'Глюкоза таблеткасы', 95, 'sweets', [[4, '1 шт (~4 г)', '1 tablet (~4 g)']], 'глюкоза декстроза'],
    // drinks (per 100 ml)
    ['juice_apple', 'Сок яблочный', 'Apple juice', 'Алма шырыны', 10, 'drinks', [[200, 'стакан', 'glass']], 'сок'],
    ['juice_orange', 'Сок апельсиновый', 'Orange juice', 'Апельсин шырыны', 9, 'drinks', [[200, 'стакан', 'glass']], 'сок'],
    ['cola', 'Кола, сладкая газировка', 'Cola, sweet soda', null, 11, 'drinks', [[330, 'банка', 'can'], [200, 'стакан', 'glass']], 'кола пепси фанта лимонад газировка'],
    ['compote', 'Компот', 'Compote', 'Компот', 12, 'drinks', [[200, 'стакан', 'glass']], ''],
    ['mors', 'Морс', 'Berry drink', null, 11, 'drinks', [[200, 'стакан', 'glass']], ''],
    ['tea_sugar', 'Чай с сахаром (1 ч. л. на кружку)', 'Tea with 1 tsp sugar', 'Қантпен шай', 2.5, 'drinks', [[200, 'кружка', 'mug']], 'чай'],
    ['latte', 'Кофе с молоком (латте)', 'Latte', null, 5, 'drinks', [[300, 'стакан', 'cup']], 'кофе капучино латте'],
    ['milkshake', 'Молочный коктейль', 'Milkshake', null, 15, 'drinks', [[300, 'стакан', 'glass']], 'коктейль'],
    ['kvass', 'Квас', 'Kvass', null, 5, 'drinks', [[200, 'стакан', 'glass']], ''],
    // nuts
    ['walnuts', 'Грецкие орехи', 'Walnuts', 'Жаңғақ', 7, 'nuts', [[30, 'горсть', 'handful']], 'орехи'],
    ['peanuts', 'Арахис', 'Peanuts', null, 10, 'nuts', [[30, 'горсть', 'handful']], 'орехи'],
    ['almonds', 'Миндаль', 'Almonds', null, 9, 'nuts', [[30, 'горсть', 'handful']], 'орехи'],
    ['seeds', 'Семечки подсолнечника', 'Sunflower seeds', null, 10, 'nuts', [[30, 'горсть', 'handful']], 'семечки'],
  ];
  const LIST = R.map(([id, ru, en, kk, c, cat, p, s]) => ({ id, ru, en, kk: kk || ru, c, cat, p: p.map(([g, pr, pe]) => ({ g, ru: pr, en: pe })), s: s || '' }));
  const BY_ID = Object.fromEntries(LIST.map(f => [f.id, f]));
  const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

  function name(f, lang) { return lang === 'en' ? f.en : lang === 'kk' ? f.kk : f.ru; }
  // Search by any name or extra word; names that start with the query come first.
  function search(q, lang = 'ru', limit = 30) {
    const query = norm(q);
    if (!query) return [];
    const words = query.split(' ');
    const scored = [];
    for (const f of LIST) {
      const hay = norm([f.ru, f.en, f.kk, f.s].join(' '));
      if (!words.every(w => hay.includes(w))) continue;
      const nm = norm(name(f, lang));
      scored.push([nm.startsWith(query) ? 0 : hay.split(' ').some(w => w.startsWith(words[0])) ? 1 : 2, nm.length, f]);
    }
    return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limit).map(x => x[2]);
  }
  const carbs = (f, grams) => Math.round((f.c * grams / 100) * 10) / 10;
  // A compact list for the AI that recognises photos: "id: name — carbs/100 g".
  const catalog = () => LIST.map(f => `${f.id}: ${f.ru} / ${f.en} — ${f.c} g/100 g`).join('\n');

  return { LIST, BY_ID, search, name, carbs, catalog };
});
