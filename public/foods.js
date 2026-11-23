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
    // ---- more foods (guide values per 100 g as eaten)
    ['blueberry', 'Голубика, черника', 'Blueberries', 'Көкжидек', 10, 'fruit', [[50, 'горсть', 'handful'], [100, 'стакан', 'cup']], 'голубика черника ягоды'],
    ['raspberry', 'Малина', 'Raspberries', 'Таңқурай', 6, 'fruit', [[50, 'горсть', 'handful']], 'малина ягоды'],
    ['currant', 'Смородина', 'Currants', 'Қарақат', 8, 'fruit', [[50, 'горсть', 'handful']], 'смородина ягоды'],
    ['cranberry', 'Клюква', 'Cranberries', null, 5, 'fruit', [[30, 'горсть', 'handful']], 'клюква ягоды'],
    ['gooseberry', 'Крыжовник', 'Gooseberries', null, 9, 'fruit', [[50, 'горсть', 'handful']], 'ягоды'],
    ['sea_buckthorn', 'Облепиха', 'Sea buckthorn', null, 5, 'fruit', [[30, 'горсть', 'handful']], 'ягоды'],
    ['mango', 'Манго', 'Mango', null, 14, 'fruit', [[150, '½ шт', '½ fruit']], ''],
    ['pineapple', 'Ананас', 'Pineapple', null, 12, 'fruit', [[100, 'порция', 'portion']], ''],
    ['grapefruit', 'Грейпфрут', 'Grapefruit', null, 7, 'fruit', [[150, '½ шт', '½ fruit']], ''],
    ['lemon', 'Лимон', 'Lemon', null, 3, 'fruit', [[20, 'долька', 'slice']], ''],
    ['nectarine', 'Нектарин', 'Nectarine', null, 9, 'fruit', [[130, '1 шт', '1 piece']], ''],
    ['fig', 'Инжир свежий', 'Fig, fresh', null, 16, 'fruit', [[50, '1 шт', '1 piece']], 'инжир'],
    ['prunes', 'Чернослив', 'Prunes', null, 57, 'fruit', [[10, '1 шт', '1 piece']], 'сухофрукты'],
    ['dried_apple', 'Сушёные яблоки', 'Dried apple', null, 60, 'fruit', [[20, 'горсть', 'handful']], 'сухофрукты'],
    ['avocado', 'Авокадо', 'Avocado', null, 2, 'fruit', [[70, '½ шт', '½ fruit']], ''],
    ['applesauce', 'Пюре фруктовое детское', 'Fruit purée (baby)', null, 12, 'fruit', [[90, 'пакетик', 'pouch']], 'пюре фруктовое агуша фрутоняня'],
    ['crispbread_buckwheat', 'Хлебцы гречневые', 'Buckwheat crispbread', null, 70, 'bread', [[6, '1 шт', '1 piece'], [12, '2 шт', '2 pieces']], 'хлебцы'],
    ['crispbread_rice', 'Хлебцы рисовые', 'Rice cakes', null, 78, 'bread', [[8, '1 шт', '1 piece']], 'хлебцы рисовые'],
    ['crispbread_rye', 'Хлебцы ржаные', 'Rye crispbread', null, 58, 'bread', [[10, '1 шт', '1 piece']], 'хлебцы'],
    ['toast', 'Тост, хлеб для тостов', 'Toast bread', null, 47, 'bread', [[25, '1 ломтик', '1 slice']], 'тост'],
    ['bun_sweet', 'Булочка сдобная', 'Sweet bun', null, 52, 'bread', [[60, '1 шт', '1 piece']], 'булочка плюшка'],
    ['bagel', 'Бублик', 'Bagel', null, 55, 'bread', [[80, '1 шт', '1 piece']], ''],
    ['pita', 'Пита', 'Pita', null, 50, 'bread', [[60, '1 шт', '1 piece']], ''],
    ['chebupeli', 'Чебурек', 'Chebureki', null, 28, 'bread', [[120, '1 шт', '1 piece']], 'чебурек'],
    ['belyash', 'Беляш', 'Belyash', null, 30, 'bread', [[100, '1 шт', '1 piece']], ''],
    ['khachapuri', 'Хачапури', 'Khachapuri', null, 35, 'bread', [[150, 'порция', 'portion']], ''],
    ['pie_cabbage', 'Пирожок печёный с капустой', 'Baked cabbage pie', null, 40, 'bread', [[70, '1 шт', '1 piece']], 'пирожок'],
    ['pie_apple', 'Пирог с яблоками', 'Apple pie', null, 45, 'bread', [[100, 'кусок', 'slice']], 'шарлотка пирог'],
    ['pancake_thick', 'Панкейки', 'American pancakes', null, 32, 'bread', [[50, '1 шт', '1 piece']], 'панкейк'],
    ['granola', 'Гранола', 'Granola', null, 60, 'grains', [[40, 'порция', 'portion']], 'гранола'],
    ['oat_flakes_dry', 'Овсяные хлопья сухие', 'Rolled oats, dry', null, 60, 'grains', [[40, '4 ст. л.', '4 tbsp']], 'геркулес овсянка хлопья'],
    ['oat_instant', 'Овсянка быстрого приготовления', 'Instant oatmeal', null, 18, 'grains', [[200, 'тарелка', 'bowl']], 'овсянка быстрая каша минутка'],
    ['semolina_water', 'Манная каша на воде', 'Semolina porridge, water', null, 13, 'grains', [[200, 'тарелка', 'bowl']], 'манка'],
    ['rice_porridge', 'Рисовая каша на молоке', 'Rice milk porridge', null, 17, 'grains', [[200, 'тарелка', 'bowl']], 'рисовая каша'],
    ['corn_porridge', 'Кукурузная каша', 'Corn porridge (polenta)', null, 15, 'grains', [[200, 'тарелка', 'bowl']], 'кукурузная мамалыга'],
    ['wheat_porridge', 'Пшеничная каша', 'Wheat porridge', null, 20, 'grains', [[150, 'порция', 'portion']], 'артек полтавская'],
    ['quinoa', 'Киноа варёная', 'Quinoa, cooked', null, 18, 'grains', [[150, 'порция', 'portion']], ''],
    ['brown_rice', 'Рис бурый варёный', 'Brown rice, cooked', null, 23, 'grains', [[150, 'порция', 'portion']], 'рис'],
    ['noodles_egg', 'Лапша яичная варёная', 'Egg noodles, cooked', null, 25, 'grains', [[150, 'порция', 'portion']], 'лапша'],
    ['noodles_instant', 'Лапша быстрого приготовления', 'Instant noodles', null, 27, 'grains', [[250, 'порция', 'serving']], 'доширак роллтон лапша'],
    ['funchoza', 'Фунчоза варёная', 'Glass noodles, cooked', null, 25, 'grains', [[150, 'порция', 'portion']], 'фунчоза'],
    ['chickpeas', 'Нут варёный', 'Chickpeas, cooked', null, 20, 'veg', [[100, 'порция', 'portion']], 'нут хумус'],
    ['hummus', 'Хумус', 'Hummus', null, 12, 'veg', [[50, '2 ст. л.', '2 tbsp']], ''],
    ['pumpkin', 'Тыква', 'Pumpkin', 'Асқабақ', 6, 'veg', [[150, 'порция', 'portion']], 'тыква'],
    ['cauliflower', 'Капуста цветная', 'Cauliflower', null, 4, 'veg', [[150, 'порция', 'portion']], 'капуста'],
    ['spinach', 'Шпинат', 'Spinach', null, 1, 'veg', [[50, 'порция', 'portion']], ''],
    ['radish', 'Редис', 'Radish', null, 3, 'veg', [[50, '5 шт', '5 pieces']], ''],
    ['mushrooms', 'Грибы', 'Mushrooms', null, 1, 'veg', [[100, 'порция', 'portion']], 'шампиньоны'],
    ['green_beans', 'Фасоль стручковая', 'Green beans', null, 4, 'veg', [[100, 'порция', 'portion']], ''],
    ['sauerkraut', 'Капуста квашеная', 'Sauerkraut', null, 3, 'veg', [[100, 'порция', 'portion']], ''],
    ['pickles', 'Огурцы солёные', 'Pickled cucumbers', null, 2, 'veg', [[60, '1 шт', '1 piece']], ''],
    ['veg_salad', 'Салат из свежих овощей', 'Fresh vegetable salad', null, 4, 'veg', [[150, 'порция', 'portion']], 'салат огурцы помидоры'],
    ['ketchup', 'Кетчуп', 'Ketchup', null, 24, 'veg', [[15, '1 ст. л.', '1 tbsp']], 'соус'],
    ['mayonnaise', 'Майонез', 'Mayonnaise', null, 3, 'protein', [[15, '1 ст. л.', '1 tbsp']], 'соус'],
    ['cheese_soft', 'Сыр мягкий, плавленый', 'Soft or processed cheese', null, 2, 'dairy', [[20, '1 шт', '1 piece']], 'сыр бэбибел babybel плавленый виола хохланд'],
    ['brynza', 'Брынза', 'Brynza (feta)', null, 1, 'dairy', [[30, 'кусочек', 'piece']], 'брынза фета сыр'],
    ['mozzarella', 'Моцарелла', 'Mozzarella', null, 1, 'dairy', [[30, 'порция', 'portion']], 'сыр'],
    ['kurt', 'Курт', 'Kurt (dried yogurt)', 'Құрт', 8, 'dairy', [[10, '1 шт', '1 piece']], 'курт'],
    ['tvorog_sweet', 'Творожная масса сладкая', 'Sweet curd spread', null, 20, 'dairy', [[100, 'порция', 'portion']], 'творожок даниссимо'],
    ['curd_dessert', 'Творожок детский', 'Kids curd dessert', null, 13, 'dairy', [[100, 'стаканчик', 'cup']], 'творожок агуша растишка'],
    ['ryazhenka', 'Ряженка', 'Ryazhenka (baked milk kefir)', null, 4, 'dairy', [[200, 'стакан', 'glass']], ''],
    ['milk_choc', 'Молоко шоколадное', 'Chocolate milk', null, 10, 'dairy', [[200, 'пакет', 'carton']], 'какао'],
    ['cocoa', 'Какао на молоке', 'Cocoa with milk', null, 11, 'dairy', [[200, 'кружка', 'mug']], 'какао несквик'],
    ['butter', 'Масло сливочное', 'Butter', null, 1, 'protein', [[10, 'на бутерброд', 'for a sandwich']], 'масло'],
    ['turkey', 'Индейка', 'Turkey', null, 0, 'protein', [[100, 'порция', 'portion']], 'мясо'],
    ['pork', 'Свинина', 'Pork', null, 0, 'protein', [[100, 'порция', 'portion']], 'мясо'],
    ['liver', 'Печень', 'Liver', null, 3, 'protein', [[100, 'порция', 'portion']], ''],
    ['meatballs', 'Тефтели в соусе', 'Meatballs in sauce', null, 8, 'dishes', [[150, 'порция', 'portion']], 'фрикадельки тефтели'],
    ['chicken_nuggets', 'Наггетсы', 'Chicken nuggets', null, 15, 'dishes', [[100, '6 шт', '6 pieces']], ''],
    ['fish_sticks', 'Рыбные палочки', 'Fish sticks', null, 18, 'dishes', [[100, '4 шт', '4 pieces']], ''],
    ['ham', 'Ветчина', 'Ham', null, 1, 'protein', [[30, '2 ломтика', '2 slices']], ''],
    ['tuna', 'Тунец консервированный', 'Tuna, canned', null, 0, 'protein', [[80, 'порция', 'portion']], 'рыба'],
    ['caviar_red', 'Икра красная', 'Red caviar', null, 0, 'protein', [[20, 'на бутерброд', 'for a sandwich']], ''],
    ['egg_fried', 'Яичница', 'Fried eggs', null, 1, 'protein', [[110, 'из 2 яиц', '2 eggs']], 'яйца глазунья'],
    ['casserole', 'Творожная запеканка', 'Cottage cheese bake', null, 18, 'dishes', [[150, 'порция', 'portion']], 'запеканка'],
    ['golubtsy', 'Голубцы', 'Cabbage rolls', null, 8, 'dishes', [[200, '2 шт', '2 pieces']], ''],
    ['solyanka', 'Солянка', 'Solyanka soup', null, 4, 'dishes', [[300, 'тарелка', 'bowl']], 'суп'],
    ['pea_soup', 'Гороховый суп', 'Pea soup', null, 9, 'dishes', [[300, 'тарелка', 'bowl']], 'суп'],
    ['rassolnik', 'Рассольник', 'Rassolnik soup', null, 6, 'dishes', [[300, 'тарелка', 'bowl']], 'суп'],
    ['milk_soup', 'Суп молочный с вермишелью', 'Milk soup with noodles', null, 11, 'dishes', [[250, 'тарелка', 'bowl']], 'суп молочный'],
    ['okroshka', 'Окрошка на кефире', 'Okroshka', null, 5, 'dishes', [[300, 'тарелка', 'bowl']], 'суп'],
    ['navy_pasta', 'Макароны по-флотски', 'Pasta with minced meat', null, 20, 'dishes', [[200, 'порция', 'portion']], 'макароны'],
    ['khinkali', 'Хинкали', 'Khinkali', null, 22, 'dishes', [[60, '1 шт', '1 piece'], [240, '4 шт', '4 pieces']], ''],
    ['chuchvara', 'Чучпара', 'Chuchvara (small dumplings)', null, 22, 'dishes', [[200, 'порция', 'portion']], 'пельмени'],
    ['kespe', 'Кеспе (лапша домашняя) с мясом', 'Kespe noodles with meat', 'Кеспе', 18, 'dishes', [[250, 'порция', 'portion']], 'лапша'],
    ['kattama', 'Катлама', 'Katlama (layered flatbread)', null, 45, 'bread', [[80, 'кусок', 'piece']], ''],
    ['zhent', 'Жент', 'Zhent (millet sweet)', 'Жент', 55, 'sweets', [[30, 'кусочек', 'piece']], ''],
    ['irimshik', 'Иримшик', 'Irimshik (curd cheese)', 'Ірімшік', 10, 'dairy', [[30, 'порция', 'portion']], ''],
    ['sushi_set', 'Суши, нигири', 'Nigiri sushi', null, 30, 'dishes', [[30, '1 шт', '1 piece']], 'суши'],
    ['wok', 'Вок с лапшой', 'Noodle stir-fry', null, 20, 'dishes', [[300, 'порция', 'portion']], 'вок лапша'],
    ['caesar', 'Салат Цезарь', 'Caesar salad', null, 7, 'dishes', [[200, 'порция', 'portion']], 'салат'],
    ['sandwich', 'Бутерброд с колбасой/сыром', 'Sandwich (sausage/cheese)', null, 25, 'dishes', [[60, '1 шт', '1 piece']], 'бутерброд'],
    ['donut', 'Пончик', 'Doughnut', null, 50, 'sweets', [[60, '1 шт', '1 piece']], 'пончик'],
    ['muffin', 'Маффин, кекс', 'Muffin', null, 52, 'sweets', [[70, '1 шт', '1 piece']], 'кекс маффин'],
    ['gingerbread', 'Пряник', 'Gingerbread', null, 75, 'sweets', [[40, '1 шт', '1 piece']], 'пряник'],
    ['oat_cookies', 'Печенье овсяное', 'Oat cookies', null, 70, 'sweets', [[15, '1 шт', '1 piece']], 'печенье'],
    ['cereal_bar', 'Батончик злаковый', 'Cereal bar', null, 65, 'sweets', [[25, '1 шт', '1 piece']], 'батончик'],
    ['choc_bar', 'Шоколадный батончик (Snickers и т. п.)', 'Chocolate bar', null, 60, 'sweets', [[50, '1 шт', '1 bar']], 'сникерс марс твикс батончик'],
    ['kinder', 'Киндер, детский шоколад', 'Kids chocolate', null, 53, 'sweets', [[12, '1 палочка', '1 bar']], 'киндер'],
    ['jelly_candy', 'Мармелад, жевательные конфеты', 'Gummies, jelly sweets', null, 78, 'sweets', [[10, '3 шт', '3 pieces']], 'мармелад мармеладки'],
    ['lollipop', 'Леденец', 'Lollipop', null, 95, 'sweets', [[10, '1 шт', '1 piece']], 'чупа чупс'],
    ['sorbet', 'Мороженое фруктовый лёд', 'Ice lolly', null, 25, 'sweets', [[70, '1 шт', '1 piece']], 'мороженое'],
    ['condensed_milk', 'Сгущёнка', 'Condensed milk', null, 55, 'sweets', [[20, '1 ст. л.', '1 tbsp']], 'сгущенка'],
    ['nutella', 'Шоколадная паста', 'Chocolate spread', null, 57, 'sweets', [[15, '1 ст. л.', '1 tbsp']], 'нутелла паста'],
    ['popcorn', 'Попкорн сладкий', 'Sweet popcorn', null, 75, 'sweets', [[30, 'горсть', 'handful']], ''],
    ['chips', 'Чипсы', 'Crisps', null, 50, 'sweets', [[30, 'маленькая пачка', 'small bag']], 'чипсы'],
    ['baursak_sweet', 'Чак-чак, хворост', 'Khvorost', null, 60, 'sweets', [[30, 'порция', 'portion']], 'хворост'],
    ['juice_multi', 'Сок мультифрукт, нектар', 'Multifruit juice, nectar', null, 12, 'drinks', [[200, 'стакан', 'glass']], 'сок нектар'],
    ['juice_kids', 'Сок детский в коробочке', 'Kids juice box', null, 11, 'drinks', [[200, 'коробочка', 'box']], 'сок агуша'],
    ['ice_tea', 'Холодный чай сладкий', 'Sweet iced tea', null, 8, 'drinks', [[330, 'бутылка', 'bottle']], 'липтон'],
    ['kisel', 'Кисель', 'Kissel', null, 14, 'drinks', [[200, 'стакан', 'glass']], ''],
    ['smoothie', 'Смузи фруктовый', 'Fruit smoothie', null, 13, 'drinks', [[250, 'стакан', 'glass']], 'смузи'],
    ['sport_drink', 'Спортивный напиток', 'Sports drink', null, 6, 'drinks', [[500, 'бутылка', 'bottle']], 'изотоник'],
    ['cashew', 'Кешью', 'Cashews', null, 27, 'nuts', [[30, 'горсть', 'handful']], 'орехи'],
    ['hazelnut', 'Фундук', 'Hazelnuts', null, 9, 'nuts', [[30, 'горсть', 'handful']], 'орехи'],
    ['pistachio', 'Фисташки', 'Pistachios', null, 18, 'nuts', [[30, 'горсть', 'handful']], 'орехи'],
    ['peanut_butter', 'Арахисовая паста', 'Peanut butter', null, 15, 'nuts', [[15, '1 ст. л.', '1 tbsp']], 'паста'],
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

  // How fast the carbs of a food reach the blood: 'fast' (high glycaemic index: white flour,
  // semolina, rice, potatoes, sweets, juice, very sweet fruit), 'medium', 'slow' (whole grains,
  // legumes, vegetables, nuts); 'protein' for foods with almost no carbs (meat, fish, eggs, cheese, butter).
  const FAST = new Set('bread_white lavash lepeshka baursak croissant cookies crackers sushki rice semolina semolina_water rice_porridge millet mash potato potato_fried cornflakes muesli blini oladyi pancake_thick toast bun_sweet bagel pita kattama crispbread_rice crispbread_buckwheat oat_instant noodles_instant banana grapes watermelon melon dates raisins kuraga prunes dried_apple persimmon mango pineapple applesauce sugar honey jam caramel marshmallow candy cake waffles chakchak glucose_tab donut muffin gingerbread jelly_candy lollipop sorbet condensed_milk popcorn cereal_bar baursak_sweet zhent juice_apple juice_orange juice_multi juice_kids cola compote mors tea_sugar milkshake kvass ice_tea kisel smoothie sport_drink yogurt_sweet syrok tvorog_sweet curd_dessert milk_choc cocoa icecream'.split(' '));
  const SLOW = new Set('buckwheat bulgur barley quinoa brown_rice oat_water oat_milk oat_flakes_dry beans lentils chickpeas hummus peas bread_grain bread_rye crispbread_rye'.split(' '));
  function speed(f) {
    if (!f) return null;
    if (f.c < 4 && ['protein', 'dairy', 'nuts', 'veg', 'fruit'].includes(f.cat)) return f.cat === 'veg' || f.cat === 'fruit' ? 'slow' : 'protein';
    if (FAST.has(f.id)) return 'fast';
    if (SLOW.has(f.id) || f.cat === 'veg' || f.cat === 'nuts') return 'slow';
    return 'medium';
  }
  // Protein or fat in a meal slows the rise: meat, fish, eggs, cheese, cottage cheese, nuts, dishes with meat.
  const PF = new Set('cheese cheese_soft brynza mozzarella tvorog egg egg_fried omelet chicken beef lamb kazy fish turkey pork liver ham tuna sausage franks cutlet butter sour_cream yogurt_plain kefir ayran kurt irimshik walnuts peanuts almonds seeds cashew hazelnut pistachio peanut_butter avocado plov manty pelmeni beshbarmak lagman kuyrdak samsa pirozhok chebupeli belyash khinkali meatballs casserole syrniki'.split(' '));
  // A diary food ({id, name}) → our food, matched by id or by name (whole name, then its first word).
  function match(x) {
    if (!x) return null;
    if (x.id && BY_ID[x.id]) return BY_ID[x.id];
    const nm = String(x.name || '').trim(); if (!nm) return null;
    return search(nm, 'ru', 1)[0] || search(nm.split(/[\s,]+/)[0], 'ru', 1)[0] || null;
  }
  const speedOf = x => speed(match(x));
  const hasProteinFat = x => { const f = match(x); return !!f && (PF.has(f.id) || speed(f) === 'protein'); };
  // A compact list for the AI that recognises photos: "id: name — carbs/100 g".
  const catalog = () => LIST.map(f => `${f.id}: ${f.ru} / ${f.en} — ${f.c} g/100 g`).join('\n');

  return { LIST, BY_ID, search, name, carbs, catalog, speed, speedOf, hasProteinFat, match };
});
