import * as THREE from 'three';

// Класс для представления узла дерева
export class TreeNode {
    constructor(id, parent = null, level = 0) {
        this.id = id;
        this.parent = parent;
        this.children = [];
        this.level = level;
        this.position = new THREE.Vector3(0, 0, 0);
        this.angle = 0; // Угол относительно родителя
        this.text = '';
    }
}

// Статический массив моковых данных для графа
// Каждый узел содержит: id, parentId (null для root), text (название фильма)
export const mockData = [
    // Root узел
    { id: 0, parentId: null, text: 'Кино' },
    
    // Уровень 1: 17 узлов (14-20)
    { id: 1, parentId: 0, text: 'Матрица' },
    { id: 2, parentId: 0, text: 'Интерстеллар' },
    { id: 3, parentId: 0, text: 'Начало' },
    { id: 4, parentId: 0, text: 'Бегущий по лезвию' },
    { id: 5, parentId: 0, text: 'Побег из Шоушенка' },
    { id: 6, parentId: 0, text: 'Криминальное чтиво' },
    { id: 7, parentId: 0, text: 'Форрест Гамп' },
    { id: 8, parentId: 0, text: 'Зеленая миля' },
    { id: 9, parentId: 0, text: 'Список Шиндлера' },
    { id: 10, parentId: 0, text: 'Властелин колец' },
    { id: 11, parentId: 0, text: 'Гарри Поттер' },
    { id: 12, parentId: 0, text: 'Темный рыцарь' },
    { id: 13, parentId: 0, text: 'Терминатор' },
    { id: 14, parentId: 0, text: 'Чужой' },
    { id: 15, parentId: 0, text: 'Аватар' },
    { id: 16, parentId: 0, text: 'Титаник' },
    { id: 17, parentId: 0, text: 'Пираты Карибского моря' },
    
    // Уровень 2: 65 узлов (30-100)
    // Потомки узла 1 (Матрица)
    { id: 18, parentId: 1, text: 'Матрица: Перезагрузка' },
    { id: 19, parentId: 1, text: 'Матрица: Революция' },
    { id: 20, parentId: 1, text: 'Матрица: Воскрешение' },
    { id: 21, parentId: 1, text: 'Аниматрица' },
    { id: 22, parentId: 1, text: 'Джон Уик' },
    
    // Потомки узла 2 (Интерстеллар)
    { id: 23, parentId: 2, text: 'Престиж' },
    { id: 24, parentId: 2, text: 'Темный рыцарь: Возрождение' },
    { id: 25, parentId: 2, text: 'Дюнкерк' },
    { id: 26, parentId: 2, text: 'Тенет' },
    { id: 27, parentId: 2, text: 'Оппенгеймер' },
    
    // Потомки узла 3 (Начало)
    { id: 28, parentId: 3, text: 'Остров проклятых' },
    { id: 29, parentId: 3, text: 'Темный рыцарь' },
    { id: 30, parentId: 3, text: 'Мементо' },
    { id: 31, parentId: 3, text: 'Престиж' },
    
    // Потомки узла 4 (Бегущий по лезвию)
    { id: 32, parentId: 4, text: 'Бегущий по лезвию 2049' },
    { id: 33, parentId: 4, text: 'Блейд Раннер' },
    { id: 34, parentId: 4, text: 'Дюна' },
    { id: 35, parentId: 4, text: 'Сириус' },
    
    // Потомки узла 5 (Побег из Шоушенка)
    { id: 36, parentId: 5, text: 'Зеленая миля' },
    { id: 37, parentId: 5, text: 'Побег' },
    { id: 38, parentId: 5, text: 'Список Шиндлера' },
    { id: 39, parentId: 5, text: 'Спасти рядового Райана' },
    
    // Потомки узла 6 (Криминальное чтиво)
    { id: 40, parentId: 6, text: 'Убить Билла' },
    { id: 41, parentId: 6, text: 'Джанго освобожденный' },
    { id: 42, parentId: 6, text: 'Омерзительная восьмерка' },
    { id: 43, parentId: 6, text: 'Однажды в Голливуде' },
    
    // Потомки узла 7 (Форрест Гамп)
    { id: 44, parentId: 7, text: 'Каст Эвей' },
    { id: 45, parentId: 7, text: 'Филипп' },
    { id: 46, parentId: 7, text: 'Спасти мистера Бэнкса' },
    
    // Потомки узла 8 (Зеленая миля)
    { id: 47, parentId: 8, text: 'Побег из Шоушенка' },
    { id: 48, parentId: 8, text: 'Темная башня' },
    { id: 49, parentId: 8, text: 'Мизери' },
    
    // Потомки узла 9 (Список Шиндлера)
    { id: 50, parentId: 9, text: 'Спасти рядового Райана' },
    { id: 51, parentId: 9, text: 'Линкольн' },
    { id: 52, parentId: 9, text: 'Мюнхен' },
    { id: 53, parentId: 9, text: 'Война миров' },
    
    // Потомки узла 10 (Властелин колец)
    { id: 54, parentId: 10, text: 'Хоббит: Нежданное путешествие' },
    { id: 55, parentId: 10, text: 'Хоббит: Пустошь Смауга' },
    { id: 56, parentId: 10, text: 'Хоббит: Битва пяти воинств' },
    { id: 57, parentId: 10, text: 'Кинг Конг' },
    { id: 58, parentId: 10, text: 'Планета обезьян' },
    
    // Потомки узла 11 (Гарри Поттер)
    { id: 59, parentId: 11, text: 'Гарри Поттер и философский камень' },
    { id: 60, parentId: 11, text: 'Гарри Поттер и тайная комната' },
    { id: 61, parentId: 11, text: 'Гарри Поттер и узник Азкабана' },
    { id: 62, parentId: 11, text: 'Гарри Поттер и Кубок огня' },
    { id: 63, parentId: 11, text: 'Гарри Поттер и Орден Феникса' },
    { id: 64, parentId: 11, text: 'Гарри Поттер и Принц-полукровка' },
    { id: 65, parentId: 11, text: 'Гарри Поттер и Дары Смерти' },
    
    // Потомки узла 12 (Темный рыцарь)
    { id: 66, parentId: 12, text: 'Бэтмен: Начало' },
    { id: 67, parentId: 12, text: 'Темный рыцарь: Возрождение' },
    { id: 68, parentId: 12, text: 'Бэтмен против Супермена' },
    { id: 69, parentId: 12, text: 'Лига справедливости' },
    
    // Потомки узла 13 (Терминатор)
    { id: 70, parentId: 13, text: 'Терминатор 2: Судный день' },
    { id: 71, parentId: 13, text: 'Терминатор: Генезис' },
    { id: 72, parentId: 13, text: 'Терминатор: Темные судьбы' },
    { id: 73, parentId: 13, text: 'Хищник' },
    
    // Потомки узла 14 (Чужой)
    { id: 74, parentId: 14, text: 'Чужие' },
    { id: 75, parentId: 14, text: 'Чужой 3' },
    { id: 76, parentId: 14, text: 'Чужой: Воскрешение' },
    { id: 77, parentId: 14, text: 'Прометей' },
    { id: 78, parentId: 14, text: 'Чужой: Завет' },
    
    // Потомки узла 15 (Аватар)
    { id: 79, parentId: 15, text: 'Аватар: Путь воды' },
    { id: 80, parentId: 15, text: 'Титаник' },
    { id: 81, parentId: 15, text: 'Алита: Боевой ангел' },
    
    // Потомки узла 16 (Титаник)
    { id: 82, parentId: 16, text: 'Аватар' },
    { id: 83, parentId: 16, text: 'Бездна' },
    { id: 84, parentId: 16, text: 'Терминатор' },
    
    // Потомки узла 17 (Пираты Карибского моря)
    { id: 85, parentId: 17, text: 'Пираты Карибского моря: Сундук мертвеца' },
    { id: 86, parentId: 17, text: 'Пираты Карибского моря: На краю света' },
    { id: 87, parentId: 17, text: 'Пираты Карибского моря: На странных берегах' },
    { id: 88, parentId: 17, text: 'Пираты Карибского моря: Мертвецы не рассказывают сказки' },
    
    // Уровень 3: 120 узлов (60-200)
    // Потомки узлов уровня 2
    { id: 89, parentId: 18, text: 'Матрица: Аниматрица - Вторая Ренессанс' },
    { id: 90, parentId: 18, text: 'Матрица: Аниматрица - За гранью' },
    { id: 91, parentId: 19, text: 'Матрица: Аниматрица - Программа' },
    { id: 92, parentId: 19, text: 'Матрица: Аниматрица - Мировой рекорд' },
    { id: 93, parentId: 20, text: 'Матрица: Аниматрица - Детский рассказ' },
    { id: 94, parentId: 20, text: 'Матрица: Аниматрица - Матрицизированный' },
    { id: 95, parentId: 22, text: 'Джон Уик 2' },
    { id: 96, parentId: 22, text: 'Джон Уик 3' },
    { id: 97, parentId: 22, text: 'Джон Уик 4' },
    { id: 98, parentId: 23, text: 'Темный рыцарь' },
    { id: 99, parentId: 23, text: 'Начало' },
    { id: 100, parentId: 24, text: 'Бэтмен: Начало' },
    { id: 101, parentId: 24, text: 'Темный рыцарь' },
    { id: 102, parentId: 25, text: 'Операция Дюнкерк' },
    { id: 103, parentId: 25, text: 'Темный рыцарь: Возрождение' },
    { id: 104, parentId: 26, text: 'Интерстеллар' },
    { id: 105, parentId: 26, text: 'Начало' },
    { id: 106, parentId: 27, text: 'Дюнкерк' },
    { id: 107, parentId: 27, text: 'Темный рыцарь: Возрождение' },
    { id: 108, parentId: 28, text: 'Начало' },
    { id: 109, parentId: 28, text: 'Престиж' },
    { id: 110, parentId: 29, text: 'Бэтмен: Начало' },
    { id: 111, parentId: 29, text: 'Темный рыцарь: Возрождение' },
    { id: 112, parentId: 30, text: 'Начало' },
    { id: 113, parentId: 30, text: 'Престиж' },
    { id: 114, parentId: 31, text: 'Темный рыцарь' },
    { id: 115, parentId: 31, text: 'Начало' },
    { id: 116, parentId: 32, text: 'Блейд Раннер' },
    { id: 117, parentId: 32, text: 'Дюна' },
    { id: 118, parentId: 33, text: 'Бегущий по лезвию' },
    { id: 119, parentId: 33, text: 'Бегущий по лезвию 2049' },
    { id: 120, parentId: 34, text: 'Дюна: Часть вторая' },
    { id: 121, parentId: 34, text: 'Бегущий по лезвию 2049' },
    { id: 122, parentId: 35, text: 'Дюна' },
    { id: 123, parentId: 35, text: 'Бегущий по лезвию' },
    { id: 124, parentId: 36, text: 'Побег из Шоушенка' },
    { id: 125, parentId: 36, text: 'Список Шиндлера' },
    { id: 126, parentId: 37, text: 'Побег из Шоушенка' },
    { id: 127, parentId: 37, text: 'Зеленая миля' },
    { id: 128, parentId: 38, text: 'Побег из Шоушенка' },
    { id: 129, parentId: 38, text: 'Зеленая миля' },
    { id: 130, parentId: 39, text: 'Список Шиндлера' },
    { id: 131, parentId: 39, text: 'Спасти рядового Райана' },
    { id: 132, parentId: 40, text: 'Криминальное чтиво' },
    { id: 133, parentId: 40, text: 'Убить Билла 2' },
    { id: 134, parentId: 41, text: 'Криминальное чтиво' },
    { id: 135, parentId: 41, text: 'Убить Билла' },
    { id: 136, parentId: 42, text: 'Джанго освобожденный' },
    { id: 137, parentId: 42, text: 'Криминальное чтиво' },
    { id: 138, parentId: 43, text: 'Убить Билла' },
    { id: 139, parentId: 43, text: 'Джанго освобожденный' },
    { id: 140, parentId: 44, text: 'Форрест Гамп' },
    { id: 141, parentId: 44, text: 'Зеленая миля' },
    { id: 142, parentId: 45, text: 'Форрест Гамп' },
    { id: 143, parentId: 45, text: 'Каст Эвей' },
    { id: 144, parentId: 46, text: 'Форрест Гамп' },
    { id: 145, parentId: 46, text: 'Спасти мистера Бэнкса' },
    { id: 146, parentId: 47, text: 'Зеленая миля' },
    { id: 147, parentId: 47, text: 'Побег из Шоушенка' },
    { id: 148, parentId: 48, text: 'Зеленая миля' },
    { id: 149, parentId: 48, text: 'Темная башня' },
    { id: 150, parentId: 49, text: 'Зеленая миля' },
    { id: 151, parentId: 49, text: 'Мизери' },
    { id: 152, parentId: 50, text: 'Список Шиндлера' },
    { id: 153, parentId: 50, text: 'Спасти рядового Райана' },
    { id: 154, parentId: 51, text: 'Список Шиндлера' },
    { id: 155, parentId: 51, text: 'Линкольн' },
    { id: 156, parentId: 52, text: 'Список Шиндлера' },
    { id: 157, parentId: 52, text: 'Мюнхен' },
    { id: 158, parentId: 53, text: 'Список Шиндлера' },
    { id: 159, parentId: 53, text: 'Война миров' },
    { id: 160, parentId: 54, text: 'Властелин колец: Братство кольца' },
    { id: 161, parentId: 54, text: 'Властелин колец: Две крепости' },
    { id: 162, parentId: 55, text: 'Властелин колец: Возвращение короля' },
    { id: 163, parentId: 55, text: 'Хоббит: Нежданное путешествие' },
    { id: 164, parentId: 56, text: 'Хоббит: Пустошь Смауга' },
    { id: 165, parentId: 56, text: 'Хоббит: Битва пяти воинств' },
    { id: 166, parentId: 57, text: 'Властелин колец' },
    { id: 167, parentId: 57, text: 'Кинг Конг' },
    { id: 168, parentId: 58, text: 'Властелин колец' },
    { id: 169, parentId: 58, text: 'Планета обезьян' },
    { id: 170, parentId: 59, text: 'Гарри Поттер и философский камень' },
    { id: 171, parentId: 59, text: 'Гарри Поттер и тайная комната' },
    { id: 172, parentId: 60, text: 'Гарри Поттер и узник Азкабана' },
    { id: 173, parentId: 60, text: 'Гарри Поттер и Кубок огня' },
    { id: 174, parentId: 61, text: 'Гарри Поттер и Орден Феникса' },
    { id: 175, parentId: 61, text: 'Гарри Поттер и Принц-полукровка' },
    { id: 176, parentId: 62, text: 'Гарри Поттер и Дары Смерти: Часть 1' },
    { id: 177, parentId: 62, text: 'Гарри Поттер и Дары Смерти: Часть 2' },
    { id: 178, parentId: 63, text: 'Гарри Поттер и философский камень' },
    { id: 179, parentId: 63, text: 'Гарри Поттер и тайная комната' },
    { id: 180, parentId: 64, text: 'Гарри Поттер и узник Азкабана' },
    { id: 181, parentId: 64, text: 'Гарри Поттер и Кубок огня' },
    { id: 182, parentId: 65, text: 'Гарри Поттер и Орден Феникса' },
    { id: 183, parentId: 65, text: 'Гарри Поттер и Принц-полукровка' },
    { id: 184, parentId: 66, text: 'Темный рыцарь' },
    { id: 185, parentId: 66, text: 'Бэтмен: Начало' },
    { id: 186, parentId: 67, text: 'Темный рыцарь: Возрождение' },
    { id: 187, parentId: 67, text: 'Темный рыцарь' },
    { id: 188, parentId: 68, text: 'Бэтмен против Супермена' },
    { id: 189, parentId: 68, text: 'Лига справедливости' },
    { id: 190, parentId: 69, text: 'Бэтмен против Супермена' },
    { id: 191, parentId: 69, text: 'Лига справедливости' },
    { id: 192, parentId: 70, text: 'Терминатор' },
    { id: 193, parentId: 70, text: 'Терминатор 2: Судный день' },
    { id: 194, parentId: 71, text: 'Терминатор: Генезис' },
    { id: 195, parentId: 71, text: 'Терминатор' },
    { id: 196, parentId: 72, text: 'Терминатор: Темные судьбы' },
    { id: 197, parentId: 72, text: 'Терминатор 2' },
    { id: 198, parentId: 73, text: 'Хищник' },
    { id: 199, parentId: 73, text: 'Терминатор' },
    { id: 200, parentId: 74, text: 'Чужой' },
    { id: 201, parentId: 74, text: 'Чужие' },
    { id: 202, parentId: 75, text: 'Чужой 3' },
    { id: 203, parentId: 75, text: 'Чужие' },
    { id: 204, parentId: 76, text: 'Чужой: Воскрешение' },
    { id: 205, parentId: 76, text: 'Чужой 3' },
    { id: 206, parentId: 77, text: 'Прометей' },
    { id: 207, parentId: 77, text: 'Чужой' },
    { id: 208, parentId: 78, text: 'Чужой: Завет' },
    { id: 209, parentId: 78, text: 'Прометей' },
    { id: 210, parentId: 79, text: 'Аватар' },
    { id: 211, parentId: 79, text: 'Аватар: Путь воды' },
    { id: 212, parentId: 80, text: 'Титаник' },
    { id: 213, parentId: 80, text: 'Аватар' },
    { id: 214, parentId: 81, text: 'Алита: Боевой ангел' },
    { id: 215, parentId: 81, text: 'Аватар' },
    { id: 216, parentId: 82, text: 'Титаник' },
    { id: 217, parentId: 82, text: 'Аватар' },
    { id: 218, parentId: 83, text: 'Бездна' },
    { id: 219, parentId: 83, text: 'Титаник' },
    { id: 220, parentId: 84, text: 'Терминатор' },
    { id: 221, parentId: 84, text: 'Титаник' },
    { id: 222, parentId: 85, text: 'Пираты Карибского моря: Проклятие Черной жемчужины' },
    { id: 223, parentId: 85, text: 'Пираты Карибского моря: Сундук мертвеца' },
    { id: 224, parentId: 86, text: 'Пираты Карибского моря: На краю света' },
    { id: 225, parentId: 86, text: 'Пираты Карибского моря: Сундук мертвеца' },
    { id: 226, parentId: 87, text: 'Пираты Карибского моря: На странных берегах' },
    { id: 227, parentId: 87, text: 'Пираты Карибского моря: На краю света' },
    { id: 228, parentId: 88, text: 'Пираты Карибского моря: Мертвецы не рассказывают сказки' },
    { id: 229, parentId: 88, text: 'Пираты Карибского моря: На странных берегах' }
];
