// 修改此文件即可管理「书影音」各分类的作品，按填写顺序上架。
// 字段说明：
// - title: 作品名称
// - creator: 创作者（歌手 / 作者 / 导演 / 出品方）
// - year: 年份（如 2026、2024、1999）
// - era: '2026' 表示收录在 2026 年记录中；选择「全部」时展示所有条目。
// - color: 拟物侧脊/封面的主色调（十六进制颜色）
// - accent: 辅助渐变或唱片中心贴纸色
// - cover: 可选，自定义封面图片路径（如 './photos/xxx.jpg' 或 'https://...'）；未填时自动生成高质感艺术封面
// - rating: 可选，个人评分（如 '9.8' 或 '★★★★★'）
// - note: 可选，你对这部作品的一句话短评（点击或悬停侧脊时在展台下方展示）
window.SHELF_CONFIG = Object.freeze({
  title: '书影音',
  handle: '@X1a0hu',
  defaultCategory: 'albums',
  defaultTheme: 'dark', // 'dark'（纯黑暗房）或 'light'（原版暖白）

  categories: {
    albums: {
      label: 'Albums',
      cnLabel: '专辑',
      defaultLook: 'cds',
      looks: [
        { id: 'cds', label: 'CDs' },
        { id: 'tapes', label: 'Tapes' },
        { id: 'covers', label: 'Covers' },
        { id: 'vinyl', label: 'Vinyl' },
        { id: 'spin', label: 'Vinyl Spin' },
        { id: 'player', label: 'Player' },
      ],
      items: [
        { title: 'Random Access Memories', creator: 'Daft Punk', year: '2013', era: '2026', color: '#0e0e10', accent: '#e5b85c', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg', rating: '10.0', note: '模拟合成器与真人乐手录制的巅峰之作，吉奥乔独白百听不厌。' },
        { title: 'Blonde', creator: 'Frank Ocean', year: '2016', era: '2026', color: '#edeae4', accent: '#2c6b4f', cover: 'https://upload.wikimedia.org/wikipedia/en/a/a0/Blonde_-_Frank_Ocean.jpeg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.8', note: '极简吉他与环境采样编织出的夏日记忆，越到深夜越有后劲。' },
        { title: 'In Rainbows', creator: 'Radiohead', year: '2007', era: '2026', color: '#101012', accent: '#e8432d', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg', rating: '9.9', note: '冰冷电子与温暖器乐最完美的一次平衡，Weird Fishes 的鼓点永远迷人。' },
        { title: '范特西', creator: '周杰伦', year: '2001', era: '2026', color: '#c41e24', accent: '#f7e4b4', cover: 'https://upload.wikimedia.org/wikipedia/en/6/65/Jaychou_fantasy.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '10.0', note: '华语流行编曲想象力的天花板，每一首都像一部微型电影。' },
        { title: 'Currents', creator: 'Tame Impala', year: '2015', era: '2026', color: '#4c4663', accent: '#f4a261', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg', rating: '9.6', note: '迷幻合成器与复古贝斯线交织，像在紫色的流体里游泳。' },
        { title: '万能青年旅店', creator: '万能青年旅店', year: '2010', era: '2026', color: '#aba158', accent: '#1d1c16', cover: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Album_cover_of_Omnipotent_Youth_Society.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.9', note: '小号响起的那一刻，北方的工业烟囱与平原黄昏就扑面而来。' },
        { title: 'Melodrama', creator: 'Lorde', year: '2017', era: '2026', color: '#183075', accent: '#f08b5c', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/58/11/b1/5811b172-e180-25a6-69e6-4385fbbfb5dc/17UM1IM02207.rgb.jpg/600x600bb.jpg', rating: '9.5', note: '把一场派对散场后的孤独写成了浓烈的蓝色油画。' },
        { title: 'Discovery', creator: 'Daft Punk', year: '2001', era: '2026', color: '#0c0d12', accent: '#7cd4ff', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg/600x600bb.jpg', rating: '9.7', note: '法式浩室与采样艺术的教科书，Digital Love 的尾奏百听不腻。' },
        { title: '浮躁', creator: '王菲', year: '1996', era: '2026', color: '#f1dce0', accent: '#6b3e47', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/f6/31/d6/f631d6d6-1fd0-272a-3feb-de30b4e69ace/00602517665095.rgb.jpg/600x600bb.jpg', rating: '9.6', note: '最自由灵动的一张唱片，几乎没有歌词的吟唱却装满了夏天。' },
        { title: 'IGOR', creator: 'Tyler, The Creator', year: '2019', era: '2026', color: '#f2a9c0', accent: '#181617', cover: 'https://upload.wikimedia.org/wikipedia/en/5/51/Igor_-_Tyler%2C_the_Creator.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.4', note: '粗粝失真合成器与灵魂乐和声的奇妙碰撞。' },
        { title: '冀西南林路行', creator: '万能青年旅店', year: '2020', era: 'all', color: '#756d61', accent: '#f3efe6', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/c5/bd/a6/c5bda6ad-0ed6-849d-dc07-c6b527c0b5aa/cover.jpg/600x600bb.jpg', rating: '9.7', note: '十年磨一剑，管弦与摇滚交织出的山河长卷。' },
        { title: 'Channel Orange', creator: 'Frank Ocean', year: '2012', era: 'all', color: '#e66e22', accent: '#ffffff', cover: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Channel_ORANGE.jpg/330px-Channel_ORANGE.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail', rating: '9.5', note: 'Pyramids 的十分钟叙事转场至今无人能及。' },
        { title: 'OK Computer', creator: 'Radiohead', year: '1997', era: 'all', color: '#e2ebf2', accent: '#1e3a5f', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg', rating: '9.9', note: '二十多年前写下的现代人疏离感预言。' },
        { title: 'After Hours', creator: 'The Weeknd', year: '2020', era: 'all', color: '#1f0d0c', accent: '#e8b968', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/2b/b9/fe/2bb9fef5-d7f3-8345-25a9-db0e79fde4e4/20UMGIM11048.rgb.jpg/600x600bb.jpg', rating: '9.3', note: '午夜霓虹都市的复古合成器浪潮。' },
      ],
    },

    songs: {
      label: 'Songs',
      cnLabel: '单曲',
      defaultLook: 'player',
      looks: [
        { id: 'player', label: 'Player' },
        { id: 'covers', label: 'Covers' },
        { id: 'spin', label: 'Vinyl Spin' },
        { id: 'cds', label: 'CDs' },
      ],
      items: [
        { title: 'Instant Crush', creator: 'Daft Punk ft. Julian Casablancas', year: '2013', era: '2026', color: '#1f2937', accent: '#f59e0b', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg', rating: '10.0', note: '声码器人声与合成器主音最浪漫的一次交汇。' },
        { title: 'Weird Fishes / Arpeggi', creator: 'Radiohead', year: '2007', era: '2026', color: '#1c242b', accent: '#38bdf8', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg', rating: '9.9', note: '层层叠加的吉他琶音像潜入深海又浮出水面。' },
        { title: '杀死那个石家庄人', creator: '万能青年旅店', year: '2010', era: '2026', color: '#3b3024', accent: '#d97706', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/62/43/86/6243868c-c362-74d0-68d5-1de5e89986ee/cover.jpg/600x600bb.jpg', rating: '10.0', note: '平静叙事下的巨大暗流。' },
        { title: 'Self Control', creator: 'Frank Ocean', year: '2016', era: '2026', color: '#284b3c', accent: '#fde68a', cover: 'https://upload.wikimedia.org/wikipedia/en/a/a0/Blonde_-_Frank_Ocean.jpeg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.8', note: '尾段多重人声合唱每次听都会起鸡皮疙瘩。' },
        { title: 'Let It Happen', creator: 'Tame Impala', year: '2015', era: '2026', color: '#3b1c54', accent: '#f43f5e', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/600x600bb.jpg', rating: '9.7', note: '七分多钟的迷幻旅程，中段卡碟循环的处理神来之笔。' },
        { title: '以父之名', creator: '周杰伦', year: '2003', era: '2026', color: '#451a1c', accent: '#d4af37', cover: 'https://upload.wikimedia.org/wikipedia/en/3/30/Yehuimei.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.9', note: '歌剧女高音与古典弦乐切入嘻哈节拍的经典时刻。' },
        { title: 'Midnight City', creator: 'M83', year: '2011', era: '2026', color: '#1e1b4b', accent: '#ec4899', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/73/c6/ed/73c6edb3-924c-27f0-28f8-1470906d6780/cover.jpg/600x600bb.jpg', rating: '9.6', note: '夜晚开车或写代码时的最佳背景音，尾段萨克斯封神。' },
        { title: 'Ribs', creator: 'Lorde', year: '2013', era: '2026', color: '#172554', accent: '#93c5fd', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/96/a5/09/96a50916-169b-724c-b722-b8c474406352/13UAAIM68691.rgb.jpg/600x600bb.jpg', rating: '9.5', note: '渐强的环境音墙把成长的焦虑与怀念推向顶点。' },
        { title: 'Space Song', creator: 'Beach House', year: '2015', era: '2026', color: '#31102f', accent: '#fbcfe8', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg', rating: '9.6', note: '滑棒吉他一响就像漂浮在失重的星云里。' },
        { title: '晴天', creator: '周杰伦', year: '2003', era: '2026', color: '#1e3a5f', accent: '#bae6fd', cover: 'https://upload.wikimedia.org/wikipedia/en/3/30/Yehuimei.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.8', note: '前奏的木吉他拨弦是多少人的青春开场白。' },
        { title: '采石', creator: '万能青年旅店', year: '2020', era: 'all', color: '#273832', accent: '#a7f3d0', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/c5/bd/a6/c5bda6ad-0ed6-849d-dc07-c6b527c0b5aa/cover.jpg/600x600bb.jpg', rating: '9.7', note: '自由爵士与摇滚乐的铿锵对话。' },
        { title: 'Veridis Quo', creator: 'Daft Punk', year: '2001', era: 'all', color: '#231f38', accent: '#fcd34d', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg/600x600bb.jpg', rating: '9.7', note: '极简巴洛克式电子旋律，适合独自思考的夜晚。' },
      ],
    },

    movies: {
      label: 'Movies',
      cnLabel: '电影',
      defaultLook: 'vhs',
      looks: [
        { id: 'vhs', label: 'VHS' },
        { id: 'dvd', label: 'DVD' },
        { id: 'covers', label: 'Posters' },
        { id: 'scenes', label: 'Scenes' },
      ],
      items: [
        { title: 'Interstellar 星际穿越', creator: 'Christopher Nolan', year: '2014', era: '2026', color: '#152238', accent: '#e09f3e', cover: 'https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.9', note: '管风琴轰鸣下的巨浪星球与五维书架，科学与亲情的宏大交响。' },
        { title: 'Blade Runner 2049 银翼杀手2049', creator: 'Denis Villeneuve', year: '2017', era: '2026', color: '#7c2d12', accent: '#fb923c', cover: 'https://upload.wikimedia.org/wikipedia/en/9/9b/Blade_Runner_2049_poster.png?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.8', note: '罗杰·迪金斯的每一帧光影都可以直接裱起来挂在墙上。' },
        { title: '花样年华', creator: '王家卫', year: '2000', era: '2026', color: '#6b141a', accent: '#eab308', cover: 'https://upload.wikimedia.org/wikipedia/en/4/45/In_the_Mood_for_Love_movie.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.9', note: '昏黄街灯、旗袍与大提琴华尔兹，把克制拍到了极致。' },
        { title: '一一', creator: '杨德昌', year: '2000', era: '2026', color: '#1f3a3d', accent: '#a3e635', cover: 'https://upload.wikimedia.org/wikipedia/en/5/5c/Yiyiposter.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '10.0', note: '“电影发明以后，人类的生命比起以前延长了至少三倍。”' },
        { title: 'The Grand Budapest Hotel 布达佩斯大饭店', creator: 'Wes Anderson', year: '2014', era: '2026', color: '#831843', accent: '#f9a8d4', cover: 'https://upload.wikimedia.org/wikipedia/en/1/1c/The_Grand_Budapest_Hotel.png?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.6', note: '强迫症式的对称构图与童话配色背后，是对消逝文明的挽歌。' },
        { title: '千与千寻', creator: '宫崎骏', year: '2001', era: '2026', color: '#1e3a8a', accent: '#f87171', cover: 'https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.8', note: '海上电车驶过水面的那一段安静，不管看多少遍都依然感动。' },
        { title: 'Arrival 降临', creator: 'Denis Villeneuve', year: '2016', era: '2026', color: '#27272a', accent: '#d4d4d8', cover: 'https://upload.wikimedia.org/wikipedia/en/d/df/Arrival%2C_Movie_Poster.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.6', note: '最温柔也最富哲学思辨的硬核语言学科幻片。' },
        { title: 'La La Land 爱乐之城', creator: 'Damien Chazelle', year: '2016', era: '2026', color: '#312e81', accent: '#facc15', cover: 'https://upload.wikimedia.org/wikipedia/en/a/ab/La_La_Land_%28film%29.png?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.5', note: '最后七分钟的蒙太奇，把“如果当初”拍得既绚烂又心碎。' },
        { title: 'Eternal Sunshine 暖暖内含光', creator: 'Michel Gondry', year: '2004', era: '2026', color: '#164e63', accent: '#fdba74', cover: 'https://upload.wikimedia.org/wikipedia/en/a/a4/Eternal_Sunshine_of_the_Spotless_Mind.png?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.6', note: '在结冰的查尔斯河面上并肩躺下看星空。' },
        { title: 'Dune: Part Two 沙丘2', creator: 'Denis Villeneuve', year: '2024', era: '2026', color: '#78350f', accent: '#fcd34d', cover: 'https://upload.wikimedia.org/wikipedia/en/5/52/Dune_Part_Two_poster.jpeg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.5', note: '纯粹为大银幕视听震撼而生的太空史诗。' },
        { title: '重庆森林', creator: '王家卫', year: '1994', era: 'all', color: '#14532d', accent: '#fde047', cover: 'https://upload.wikimedia.org/wikipedia/en/c/c0/Chungking_Express.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.7', note: '凤梨罐头与加州梦，杜可风手持摄影的极致浪漫。' },
        { title: '2001: A Space Odyssey 太空漫游', creator: 'Stanley Kubrick', year: '1968', era: 'all', color: '#18181b', accent: '#ef4444', cover: 'https://upload.wikimedia.org/wikipedia/en/1/11/2001_A_Space_Odyssey_%281968%29.png?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.9', note: '半个多世纪前就定义了科幻电影的美学终局。' },
      ],
    },

    books: {
      label: 'Books',
      cnLabel: '书籍',
      defaultLook: 'spines',
      looks: [
        { id: 'spines', label: 'Spines' },
        { id: 'books', label: 'Books' },
        { id: 'covers', label: 'Covers' },
      ],
      items: [
        { title: '三体（全三册）', creator: '刘慈欣', year: '2008', era: '2026', color: '#172554', accent: '#60a5fa', cover: 'https://upload.wikimedia.org/wikipedia/en/0/0f/Threebody.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '10.0', note: '从红岸基地到二向箔降维打击，把宇宙尺度写得令人屏息。' },
        { title: '百年孤独', creator: '加西亚·马尔克斯', year: '1967', era: '2026', color: '#422006', accent: '#f59e0b', cover: 'https://upload.wikimedia.org/wikipedia/en/a/a0/Cien_a%C3%B1os_de_soledad_%28book_cover%2C_1967%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.9', note: '马孔多的雨下了四年十一个月零两天，时间在家族里画了一个圆。' },
        { title: '你一生的故事', creator: '特德·姜', year: '2002', era: '2026', color: '#1e293b', accent: '#94a3b8', cover: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Stories_of_your_life_cover.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.8', note: '每一篇短篇都像一颗切割精密的钻石，逻辑与诗意并存。' },
        { title: 'Designing Data-Intensive Applications', creator: 'Martin Kleppmann', year: '2017', era: '2026', color: '#7f1d1d', accent: '#fca5a5', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Publication221/v4/fc/84/ca/fc84ca89-4afb-14d1-f9f3-567cfd0c8768/9781098119027.jpg/600x600bb.jpg', rating: '10.0', note: '分布式系统与数据架构领域的圣经，常读常新。' },
        { title: '银河帝国：基地', creator: '艾萨克·阿西莫夫', year: '1951', era: '2026', color: '#1e1b4b', accent: '#c084fc', cover: 'https://upload.wikimedia.org/wikipedia/en/d/d9/Foundation_-_Isaac_Asimov_%28Gnome_1951%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.6', note: '心理史学与银河尺度的文明兴衰推演。' },
        { title: '看不见的城市', creator: '伊塔洛·卡尔维诺', year: '1972', era: '2026', color: '#14532d', accent: '#86efac', cover: 'https://upload.wikimedia.org/wikipedia/en/2/25/InvisibleCities.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.7', note: '马可·波罗向忽必烈描述的五十五座梦境之城，轻盈得像散文诗。' },
        { title: '深入理解计算机系统 (CSAPP)', creator: 'Randal E. Bryant', year: '2015', era: '2026', color: '#1c1917', accent: '#fb923c', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Publication3/v4/9b/1a/40/9b1a409b-2c4a-a3b7-60fa-911d20dd181a/8172cover.jpg/600x600bb.jpg', rating: '9.9', note: '打通软硬件底层脉络最好的计算机必读书。' },
        { title: '长安的荔枝', creator: '马伯庸', year: '2022', era: '2026', color: '#7c2d12', accent: '#fde047', cover: 'https://upload.wikimedia.org/wikipedia/zh/1/1d/ThelichiroadCover.jpg?utm_source=zh.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.3', note: '以一骑红尘的小人物视角剖开盛唐官场与物流的运作肌理。' },
        { title: '黑客与画家', creator: 'Paul Graham', year: '2004', era: '2026', color: '#312e81', accent: '#93c5fd', cover: 'https://is1-ssl.mzstatic.com/image/thumb/Publication/v4/e6/9f/b7/e69fb749-d5b8-681a-7f77-b2d4d2beb243/9780596550660.jpg/600x600bb.jpg', rating: '9.4', note: '关于创造力、编程语言审美与把写代码当作艺术创作的思考。' },
        { title: '刀锋', creator: '威廉·萨默塞特·毛姆', year: '1944', era: '2026', color: '#27272a', accent: '#e4e4e7', cover: 'https://upload.wikimedia.org/wikipedia/en/c/ce/The_Razor%27s_Edge_1st_ed.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.5', note: '“一把刀的锋刃很不容易越过，因此智者说得救之道是困难的。”' },
        { title: '重构：改善既有代码的设计', creator: 'Martin Fowler', year: '2018', era: 'all', color: '#3b0764', accent: '#d8b4fe', cover: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Webysther_20150414193208_-_Martin_Fowler.jpg/330px-Webysther_20150414193208_-_Martin_Fowler.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail', rating: '9.5', note: '代码整洁与演进式设计的工程指南。' },
        { title: '漫长的告别', creator: '雷蒙德·钱德勒', year: '1953', era: 'all', color: '#1f2937', accent: '#fbbf24', cover: 'https://upload.wikimedia.org/wikipedia/en/0/0d/RaymondChandler_TheLongGoodbye.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled', rating: '9.7', note: '硬汉侦探小说里最温柔也最落寞的一声叹息。' },
      ],
    },

    tv: {
      label: 'TV',
      cnLabel: '剧集',
      defaultLook: 'covers',
      looks: [
        { id: 'covers', label: 'Posters' },
        { id: 'vhs', label: 'VHS' },
        { id: 'scenes', label: 'Scenes' },
      ],
      items: [
        { title: 'Breaking Bad 绝命毒师', creator: 'Vince Gilligan', year: '2008', era: '2026', color: '#14532d', accent: '#facc15', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/501/1253519.jpg', rating: '10.0', note: '剧作结构与人物弧光的教科书，最后一季每一集都是神作。' },
        { title: 'Better Call Saul 风骚律师', creator: 'Vince Gilligan & Peter Gould', year: '2015', era: '2026', color: '#7c2d12', accent: '#fbbf24', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/501/1253515.jpg', rating: '9.9', note: '慢火细炖的摄影构图与人物悲剧感，甚至比正传更余味悠长。' },
        { title: 'Severance 人生切割术', creator: 'Dan Erickson', year: '2022', era: '2026', color: '#0f172a', accent: '#38bdf8', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/548/1371406.jpg', rating: '9.7', note: '极简冷峻的现代办公室反乌托邦，第一季结尾四十分钟全程屏息。' },
        { title: 'Arcane 双城之战', creator: 'Fortiche Production', year: '2021', era: '2026', color: '#1e1b4b', accent: '#f43f5e', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/536/1340287.jpg', rating: '9.8', note: '手绘质感与三维动画融合的视觉奇迹，美术与配乐无懈可击。' },
        { title: 'Cowboy Bebop 星际牛仔', creator: '渡边信一郎', year: '1998', era: '2026', color: '#3b0764', accent: '#f59e0b', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/178/446548.jpg', rating: '10.0', note: '菅野洋子的爵士乐配上太空浪人的浪漫，“You’re gonna carry that weight.”' },
        { title: '漫长的季节', creator: '辛爽', year: '2023', era: '2026', color: '#78350f', accent: '#fb923c', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/458/1145672.jpg', rating: '9.8', note: '秋天的玉米地与火车汽笛，“往前看，别回头。”' },
        { title: 'Chernobyl 切尔诺贝利', creator: 'Craig Mazin', year: '2019', era: '2026', color: '#1c242b', accent: '#a3e635', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/193/482599.jpg', rating: '9.8', note: '五集迷你剧拍出了压迫感十足的历史质感。' },
        { title: 'True Detective 真探 (第一季)', creator: 'Nic Pizzolatto', year: '2014', era: '2026', color: '#27272a', accent: '#d97706', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/490/1226764.jpg', rating: '9.7', note: '路易斯安那州的荒原长镜头与哲学独白。' },
        { title: 'Black Mirror 黑镜', creator: 'Charlie Brooker', year: '2011', era: '2026', color: '#18181b', accent: '#38bdf8', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/564/1411764.jpg', rating: '9.5', note: 'San Junipero 和 White Christmas 依然是科幻单元剧的巅峰。' },
        { title: 'Cyberpunk: Edgerunners 边缘行者', creator: '扳机社 TRIGGER', year: '2022', era: '2026', color: '#3b0764', accent: '#facc15', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/498/1246519.jpg', rating: '9.5', note: '当 I Really Want to Stay at Your House 响起时的月球幻梦。' },
        { title: 'Succession 继承之战', creator: 'Jesse Armstrong', year: '2018', era: 'all', color: '#1e293b', accent: '#e2e8f0', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/453/1134275.jpg', rating: '9.7', note: '古典交响配乐与手持变焦镜头下的现代莎士比亚戏剧。' },
        { title: 'Fargo 冰血暴', creator: 'Noah Hawley', year: '2014', era: 'all', color: '#1e3a5f', accent: '#f87171', cover: 'https://static.tvmaze.com/uploads/images/original_untouched/487/1219631.jpg', rating: '9.5', note: '茫茫白雪里的黑色幽默与荒诞巧合。' },
      ],
    },
  },
});
