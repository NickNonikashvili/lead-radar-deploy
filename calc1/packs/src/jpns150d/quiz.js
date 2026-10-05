/* JPNS 150D question bank. Bank items are [prompt, correct, [wrong answers], explanation].
   Written for Mathub from standard background on Japanese history and literature and the syllabus
   readings; not from the professor. Four choices, like a typical multiple-choice exam. */
const bank = (topic, items, extra = {}) => Object.assign({ type: 'bank', topic, items, options: 4 }, extra);

const topics = {
  intro: { unit: 1, sec: 'intro', label: 'Kojiki & myths' },
  origins: { unit: 1, sec: 'origins', label: 'Early periods' },
  religions: { unit: 1, sec: 'religions', label: 'Shinto & Buddhism' },
  genji: { unit: 1, sec: 'genji', label: 'The Tale of Genji' },
  pillow: { unit: 1, sec: 'pillow', label: 'The Pillow Book' },
  samurai: { unit: 2, sec: 'samurai', label: 'Rise of the samurai' },
  heike: { unit: 2, sec: 'heike', label: 'Tales of the Heike' },
  hojoki: { unit: 2, sec: 'hojoki', label: 'Chōmei’s Hōjōki' },
  kenko: { unit: 2, sec: 'kenko', label: 'Kenkō' },
  noh: { unit: 2, sec: 'noh', label: 'Noh & Zen aesthetics' },
  tokugawa: { unit: 3, sec: 'tokugawa', label: 'Pax Tokugawa' },
  saikaku: { unit: 3, sec: 'saikaku', label: 'Saikaku & the chōnin' },
  chikamatsu: { unit: 3, sec: 'chikamatsu', label: 'Chikamatsu & bunraku' },
  basho: { unit: 3, sec: 'basho', label: 'Bashō & haiku' },
  bakumatsu: { unit: 3, sec: 'bakumatsu', label: 'Bakumatsu' },
  meiji: { unit: 4, sec: 'meiji', label: 'Meiji revolution' },
  soseki: { unit: 4, sec: 'soseki', label: 'Sōseki, And Then' },
  taisho: { unit: 4, sec: 'taisho', label: 'Taishō & “Lemon”' },
  tanizaki: { unit: 4, sec: 'tanizaki', label: 'In Praise of Shadows' },
  ww2: { unit: 4, sec: 'ww2', label: 'Japan & World War II' },
  hiroshima: { unit: 4, sec: 'hiroshima', label: 'Hiroshima & memory' },
  occupation: { unit: 4, sec: 'occupation', label: 'The Occupation' },
  hijiki: { unit: 5, sec: 'hijiki', label: '“American Hijiki”' },
  familygame: { unit: 5, sec: 'familygame', label: 'The Family Game' },
  kitchen: { unit: 5, sec: 'kitchen', label: 'Kitchen & the bubble' },
  anime: { unit: 5, sec: 'anime', label: 'Akira & Ghost in the Shell' },
  thief: { unit: 5, sec: 'thief', label: 'The Thief' },
  murata: { unit: 5, sec: 'murata', label: '“Eating the City”' },
  timeline: { unit: 1, sec: 'origins', label: 'Timeline of periods' },
  works: { unit: 5, sec: 'murata', label: 'Works & authors' }
};

const ladders = {
  intro: ['Who created the islands, and who is the sun goddess?', 'Ask what the myth explains and whom it serves.', 'Kojiki 712, Nihon shoki 720.'],
  origins: ['Order: Jōmon, Yayoi, Kofun, Nara, Heian.', 'Match each period with one thing: pots, rice, mounds, Great Buddha, court.', 'Borrowing from China and Korea was adapted, not copied whole.'],
  religions: ['Shinto: kami and purity. Buddhism: impermanence and enlightenment.', 'Heian sects: Tendai, Shingon; then Pure Land after mappō.', 'Zen comes later, in the Kamakura period.'],
  genji: ['Author, era and script: Murasaki, Heian, kana.', 'Yūgao: a fleeting flower and a sudden death.', 'mono no aware: beauty through its passing.'],
  pillow: ['Sei Shōnagon, Empress Teishi, zuihitsu.', 'Lists, wit and the seasons.', 'okashi (delight) against Genji’s aware (pathos).'],
  samurai: ['Taira = Heike; Minamoto = Genji.', 'Genpei War 1180–85, Kamakura shogunate, Mongols.', 'Ashikaga, Muromachi, Ōnin War, Warring States.'],
  heike: ['Performed by blind biwa monks.', 'The theme is impermanence; the proud fall.', 'Kumagai kills Atsumori and becomes a monk.'],
  hojoki: ['Kamo no Chōmei, 1212.', 'The river and the ten-foot square hut.', 'He doubts even his attachment to the hut.'],
  kenko: ['Yoshida Kenkō, Essays in Idleness, about 1330.', 'Beauty lies in the passing and the incomplete.', 'A priest who still loves good taste: a worldly ascetic.'],
  noh: ['Kan’ami and Zeami; yūgen.', 'Stage: pine wall, bridgeway; shite and waki.', 'Zen arts: wabi, sabi, rock gardens, tea.'],
  tokugawa: ['Nobunaga, Hideyoshi, Ieyasu.', 'Sekigahara 1600, Edo, 1603–1868.', 'Alternate attendance, status order, closed country.'],
  saikaku: ['Chōnin = townspeople; ukiyo = floating world.', 'Saikaku writes prose about love and money.', 'The almanac maker’s affair ends in execution.'],
  chikamatsu: ['Bunraku: puppets, chanter, shamisen.', 'Sonezaki: Tokubei and Ohatsu.', 'giri (duty) against ninjō (feeling).'],
  basho: ['Season word and cutting word.', 'Old pond, frog, sound of water.', 'Travel diaries; sabi and karumi.'],
  bakumatsu: ['Perry 1853–54; Treaty of Kanagawa.', 'Unequal treaties: extraterritoriality, tariffs.', 'sonnō jōi; Satsuma and Chōshū; 1868.'],
  meiji: ['1868: emperor restored, capital to Tokyo.', 'Abolish domains and samurai privileges; conscription.', 'Slogans: rich country, strong army; civilization and enlightenment.'],
  soseki: ['Daisuke, Michiyo, Hiraoka.', 'Love against family duty.', 'Sōseki saw modernization as rushed and superficial.'],
  taisho: ['1912–1926, between Meiji and Shōwa.', 'Democracy, mass culture, the 1923 earthquake.', 'Kajii’s lemon as an imaginary bomb.'],
  tanizaki: ['Shadows and dimness against Western brightness.', 'Lacquerware, toilets, dim rooms.', 'Ask whether it is nostalgia or nationalism.'],
  ww2: ['1931 Manchuria, 1937 China, 1941 Pearl Harbor.', 'August 6 and 9, 1945; surrender August 15.', 'Victimizer and victim: both sides of memory.'],
  hiroshima: ['Grave of the Fireflies: Kobe, not Hiroshima.', 'Hara Tamiki: a survivor’s account.', 'Enola Gay: the 1995 Smithsonian dispute.'],
  occupation: ['MacArthur, 1945–1952.', 'Article 9, women’s suffrage, land reform.', 'Emperor kept as a symbol; reverse course.'],
  hijiki: ['Nosaka Akiyuki, 1967.', 'Toshio hosts the American Higginses.', 'Tea mistaken for hijiki seaweed under the Occupation.'],
  familygame: ['Morita Yoshimitsu, 1983.', 'A tutor and exam hell.', 'The family eating in a row facing the camera.'],
  kitchen: ['Yoshimoto Banana, 1988.', 'Mikage, Yūichi and Eriko: a chosen family.', 'Tanaka Yasuo: brands and the bubble.'],
  anime: ['Ōtomo: Akira (1988). Oshii: Ghost in the Shell (1995).', 'Tetsuo’s mutating body; the nuclear sublime.', 'Kusanagi: the ghost in an artificial shell.'],
  thief: ['Nakamura Fuminori, 2009.', 'Nishimura the pickpocket; Kizaki the boss.', 'Post-bubble isolation and fate.'],
  murata: ['Murata Sayaka; Convenience Store Woman.', 'Eating Tokyo’s wild plants.', 'Connect to the course’s big themes.'],
  timeline: ['Learn the periods in order.', 'Pair each with its dates.', 'Pair each with one image.'],
  works: ['Match each work to its author or director.', 'Then to its form: tale, miscellany, play, haiku, novel, film.', 'Then to its date.']
};

const questions = [
  bank('intro', [
    ['The Kojiki, Japan’s oldest surviving book, was compiled in', '712', ['794', '1185', '604'], 'The Kojiki (Record of Ancient Matters) dates from 712; the Nihon shoki from 720.'],
    ['In the Kojiki, the islands of Japan are created by', 'Izanagi and Izanami', ['Amaterasu and Susanoo', 'Prince Shōtoku', 'Jimmu and Ninigi'], 'The creator couple stir the sea with a jeweled spear.'],
    ['Amaterasu is', 'the sun goddess and ancestor of the imperial line', ['the storm god', 'the first human emperor', 'the goddess of the land of the dead'], 'The emperors claimed descent from her.'],
    ['Amaterasu hides in a cave because of', 'her brother Susanoo’s rampages', ['Izanami’s death', 'a Mongol invasion', 'a quarrel with Buddhist monks'], 'Her withdrawal plunges the world into darkness until the gods lure her out.'],
    ['Izanagi’s purification after visiting the land of the dead shows the importance of', 'purity and pollution', ['ancestor worship of the shoguns', 'Confucian filial piety', 'Zen meditation'], 'Contact with death pollutes; purification removes it, a core Shinto idea.'],
    ['A main political purpose of the Kojiki was to', 'give the imperial family a divine pedigree', ['record the Mongol invasions', 'introduce Buddhism', 'create the samurai class'], 'It joins the gods’ myths to the imperial genealogy.']
  ]),
  bank('origins', [
    ['Which period came first?', 'Jōmon', ['Yayoi', 'Kofun', 'Nara'], 'Jōmon (c. 14,000–300 BCE) is the longest and oldest.'],
    ['The Yayoi period is known for', 'wet-rice farming and bronze and iron', ['cord-marked pottery of hunter-gatherers', 'keyhole-shaped tombs', 'the first permanent capital'], 'Rice and metals arrived from the continent.'],
    ['Huge keyhole-shaped burial mounds are typical of the', 'Kofun period', ['Heian period', 'Yayoi period', 'Jōmon period'], 'Kofun means "old mound".'],
    ['Chinese records describe a third-century queen of Yamatai named', 'Himiko', ['Murasaki', 'Amaterasu', 'Teishi'], 'Himiko appears in a Chinese chronicle.'],
    ['Prince Shōtoku is remembered for', 'promoting Buddhism and the Seventeen-Article Constitution', ['founding the Kamakura shogunate', 'writing The Pillow Book', 'closing Japan to foreigners'], 'He lived from 574 to 622.'],
    ['The Great Buddha of Tōdai-ji was built in the', 'Nara period', ['Heian period', 'Kamakura period', 'Tokugawa period'], 'Nara (710–794) was Japan’s first permanent capital.'],
    ['The court moved to Heian-kyō (Kyoto) in', '794', ['710', '1185', '1603'], 'This opened the Heian period.']
  ]),
  bank('religions', [
    ['In Shinto, kami are', 'spirits or gods of nature, places and ancestors', ['Buddhist monks', 'Confucian scholars', 'samurai retainers'], 'Shinto means "the way of the kami".'],
    ['Buddhism reached Japan in the', 'sixth century, from Korea', ['twelfth century, from India', 'first century BCE, from China', 'sixteenth century, from Portugal'], 'The traditional dates are 538 or 552.'],
    ['Saichō founded the Tendai school on', 'Mt. Hiei', ['Mt. Kōya', 'Mt. Fuji', 'Ise'], 'Kūkai founded Shingon on Mt. Kōya.'],
    ['Belief in mappō, the decline of the Buddhist law, encouraged', 'Pure Land faith in Amida Buddha', ['the founding of Shinto', 'the Seventeen-Article Constitution', 'the closing of Japan'], 'People sought rebirth in Amida’s paradise.'],
    ['A torii gate marks', 'a Shinto shrine', ['a Buddhist temple’s pagoda', 'a samurai’s castle', 'a Noh stage'], 'Torii mark the entrance to sacred Shinto space.'],
    ['In practice, Shinto and Buddhism in Japan', 'blended, with kami often seen as local forms of buddhas', ['were strictly separated until 1868 by law', 'were banned in turn', 'had nothing to do with each other'], 'Most people drew on both.'],
    ['The Buddhist idea most visible in Japanese literature is', 'impermanence', ['the divine right of emperors', 'the four-class system', 'filial piety'], 'Genji, the Heike, Chōmei and Kenkō all return to it.']
  ]),
  bank('genji', [
    ['The Tale of Genji was written by', 'Murasaki Shikibu', ['Sei Shōnagon', 'Kamo no Chōmei', 'Yoshida Kenkō'], 'She was a lady-in-waiting in the early 1000s.'],
    ['Murasaki Shikibu served', 'Empress Shōshi', ['Empress Teishi', 'the shogun Yoritomo', 'Emperor Meiji'], 'Sei Shōnagon served Empress Teishi.'],
    ['Heian court women wrote mainly in', 'kana, the Japanese phonetic script', ['classical Chinese', 'Sanskrit', 'Korean hangul'], 'Men wrote official texts in Chinese.'],
    ['In “Yūgao”, Yūgao', 'dies suddenly at a deserted villa, apparently attacked by a spirit', ['marries Genji and becomes empress', 'becomes a Buddhist nun', 'writes The Pillow Book'], 'The spirit is often linked to the jealous Lady Rokujō.'],
    ['Mono no aware means', 'the pathos of things: feeling beauty through its passing', ['the delight of wit', 'mysterious, profound grace', 'rustic simplicity'], 'It is the emotional key of Genji.'],
    ['Heian politics were dominated by the', 'Fujiwara regents', ['Tokugawa shoguns', 'Minamoto clan', 'Ashikaga shoguns'], 'They married daughters to emperors.'],
    ['The Tale of Genji is often called', 'the world’s first novel', ['Japan’s first haiku collection', 'a war epic', 'a Noh play'], 'It has 54 chapters.']
  ]),
  bank('pillow', [
    ['The Pillow Book was written by', 'Sei Shōnagon', ['Murasaki Shikibu', 'Yoshimoto Banana', 'Lady Rokujō'], 'She served Empress Teishi around 1000.'],
    ['The Pillow Book belongs to the genre called', 'zuihitsu (“following the brush”)', ['monogatari (tale)', 'haiku', 'sewamono'], 'A miscellany of lists, sketches and opinions.'],
    ['The Pillow Book is famous for its', 'lists, such as “Hateful things”', ['battle scenes', 'ghost plays', 'love suicides'], 'Lists show Sei Shōnagon’s sharp eye.'],
    ['The aesthetic most linked to The Pillow Book is', 'okashi: the delightful and witty', ['mono no aware', 'yūgen', 'wabi'], 'Genji leans toward aware; The Pillow Book toward okashi.'],
    ['Murasaki Shikibu’s diary describes Sei Shōnagon as', 'conceited and showy', ['her closest friend', 'her teacher', 'her empress'], 'The basis of their legendary rivalry.'],
    ['The Pillow Book opens with', '“In spring, the dawn”', ['“The sound of the Gion bells”', '“The flow of the river is ceaseless”', '“What a strange, demented feeling”'], 'It moves through the best time of each season.']
  ]),
  bank('samurai', [
    ['The Genpei War (1180–1185) was fought between', 'the Taira and the Minamoto', ['the Tokugawa and the Toyotomi', 'Japan and the Mongols', 'Satsuma and Chōshū'], 'The Minamoto won.'],
    ['The Taira clan is also called the', 'Heike', ['Genji', 'Ashikaga', 'Fujiwara'], 'Minamoto = Genji; Taira = Heike.'],
    ['The first shogunate was founded at', 'Kamakura, by Minamoto no Yoritomo', ['Edo, by Tokugawa Ieyasu', 'Kyoto, by Ashikaga Takauji', 'Nara, by Prince Shōtoku'], 'He became shogun in 1192.'],
    ['The final battle of the Genpei War, where the child emperor Antoku drowned, was', 'Dan-no-ura', ['Sekigahara', 'Ichi-no-tani', 'Nagashino'], 'It took place in 1185.'],
    ['The "kamikaze" of the thirteenth century were', 'storms that helped wreck the Mongol invasions', ['suicide pilots', 'Zen monks', 'samurai bodyguards'], 'Divine winds, 1274 and 1281.'],
    ['The Ashikaga shoguns ruled during the', 'Muromachi period', ['Kamakura period', 'Heian period', 'Edo period'], 'Muromachi, 1336–1573.'],
    ['The Ōnin War (1467–1477) began', 'the Warring States (Sengoku) period', ['the Heian period', 'the Meiji Restoration', 'the Pax Tokugawa'], 'A century of civil war followed.']
  ]),
  bank('heike', [
    ['The Tales of the Heike was performed by', 'blind monks chanting to the lute (biwa hōshi)', ['Noh actors in masks', 'bunraku puppeteers', 'court ladies writing in kana'], 'It took shape orally over the thirteenth century.'],
    ['The opening of the Heike says the Gion bells echo', 'the impermanence of all things', ['the glory of the Minamoto', 'the arrival of Buddhism', 'the voice of Amaterasu'], 'The proud do not endure, like a dream on a spring night.'],
    ['Atsumori is killed by', 'Kumagai Naozane', ['Taira no Kiyomori', 'Minamoto no Yoritomo', 'Tokubei'], 'At the battle of Ichi-no-tani, 1184.'],
    ['After killing Atsumori, Kumagai', 'becomes a Buddhist monk', ['becomes shogun', 'commits a love suicide', 'writes the Hōjōki'], 'Remorse turns him from the warrior’s life.'],
    ['Kumagai finds on Atsumori’s body', 'a flute', ['a lemon', 'a sword from the emperor', 'a letter from Genji'], 'It marks the youth as cultured and young.'],
    ['The Heike’s view of Taira no Kiyomori stresses', 'pride that leads to his clan’s fall', ['his humble piety', 'his skill at haiku', 'his conversion to Christianity'], 'A Buddhist lesson in impermanence and karma.']
  ]),
  bank('hojoki', [
    ['The Hōjōki was written by', 'Kamo no Chōmei', ['Yoshida Kenkō', 'Matsuo Bashō', 'Ihara Saikaku'], 'In 1212.'],
    ['“Hōjōki” refers to', 'a ten-foot square hut', ['a pillow', 'a mountain pass', 'a Noh mask'], 'An Account of My Ten-Foot Square Hut.'],
    ['The Hōjōki opens with the image of', 'a river whose water is never the same', ['cherry blossoms in full bloom', 'an old pond and a frog', 'a burning castle'], 'The ceaseless flow stands for impermanence.'],
    ['Chōmei describes all of these disasters EXCEPT', 'a Mongol invasion', ['a great fire', 'a famine', 'an earthquake'], 'The Mongols came decades later, in 1274 and 1281.'],
    ['At the end of the Hōjōki, Chōmei', 'wonders whether his love of the hut is itself an attachment', ['returns to court', 'becomes shogun', 'burns the hut'], 'His self-doubt is the essay’s honest close.']
  ]),
  bank('kenko', [
    ['Essays in Idleness (Tsurezuregusa) is by', 'Yoshida Kenkō', ['Kamo no Chōmei', 'Sei Shōnagon', 'Zeami'], 'About 1330.'],
    ['Kenkō asks whether we should look at cherry blossoms only', 'in full bloom', ['at night', 'in paintings', 'in spring rain'], 'He finds beauty in the passing and incomplete.'],
    ['For Kenkō, if people lived forever', 'things would lose their power to move us', ['art would improve', 'Buddhism would end', 'Japan would be safe'], 'Perishability makes beauty.'],
    ['Kenkō is described as a "worldly ascetic" because he', 'took Buddhist vows yet loved court taste and anecdotes', ['was a samurai who became shogun', 'was a merchant who became a monk', 'refused to write'], 'Detachment of an aesthetic kind.'],
    ['Kenkō’s taste for the irregular and incomplete later influenced', 'tea and Zen aesthetics', ['Meiji industry', 'the Kojiki', 'Pure Land chanting'], 'Wabi and sabi build on such ideas.']
  ]),
  bank('noh', [
    ['Noh was developed by', 'Kan’ami and his son Zeami', ['Chikamatsu and Saikaku', 'Bashō and his disciples', 'Murasaki and Sei Shōnagon'], 'Under the patronage of the shogun Ashikaga Yoshimitsu.'],
    ['The ideal of Noh is', 'yūgen: mysterious, profound grace', ['okashi: wit', 'giri: duty', 'karumi: lightness'], 'Slow, stylized, suggestive.'],
    ['On the Noh stage, the back wall shows', 'a painted pine tree', ['a map of Kyoto', 'cherry blossoms', 'a portrait of the shogun'], 'Actors enter along the bridgeway (hashigakari).'],
    ['In Noh, the shite is', 'the main actor, often a masked ghost', ['the chanter', 'the secondary actor, often a priest', 'the puppeteer'], 'The waki is the secondary actor.'],
    ['In the Noh play Atsumori, the young warrior returns as', 'a ghost who finally forgives Kumagai', ['a puppet', 'a living emperor', 'a fox spirit'], 'Kumagai is now the priest Rensei.'],
    ['Wabi refers to', 'rustic simplicity', ['the beauty of age and loneliness', 'the floating world', 'duty to one’s lord'], 'Sabi is the beauty of age and loneliness.'],
    ['Dry rock gardens such as Ryōan-ji are linked to', 'Zen Buddhism', ['Shinto purification', 'Pure Land chanting', 'Meiji modernization'], 'Zen arts flourished in the Muromachi period.']
  ]),
  bank('tokugawa', [
    ['The three unifiers, in order, were', 'Nobunaga, Hideyoshi, Ieyasu', ['Ieyasu, Nobunaga, Hideyoshi', 'Yoritomo, Takauji, Ieyasu', 'Hideyoshi, Ieyasu, Nobunaga'], 'Ieyasu founded the lasting shogunate.'],
    ['Tokugawa Ieyasu’s decisive victory was at', 'Sekigahara, 1600', ['Dan-no-ura, 1185', 'Nagasaki, 1637', 'Ichi-no-tani, 1184'], 'He became shogun in 1603.'],
    ['Alternate attendance (sankin kōtai) required daimyo to', 'live in Edo every other year and leave their families there', ['pay taxes in silver', 'convert to Buddhism', 'serve in the emperor’s army'], 'It drained their wealth and kept hostages.'],
    ['Under the Tokugawa status order, merchants officially ranked', 'lowest of the four classes', ['highest', 'just below samurai', 'above farmers'], 'Yet many grew rich.'],
    ['During the "closed country" period, foreign trade continued', 'with the Dutch and Chinese at Nagasaki', ['with no one at all', 'freely in every port', 'only with Portugal'], 'Christianity was banned.'],
    ['The Pax Tokugawa lasted roughly', '250 years (1603–1868)', ['50 years', '100 years', '500 years'], 'A long peace that grew cities and commerce.']
  ]),
  bank('saikaku', [
    ['The chōnin were', 'townspeople: merchants and artisans', ['samurai retainers', 'court ladies', 'Buddhist monks'], 'They created Edo urban culture.'],
    ['In the Edo period, ukiyo ("floating world") meant', 'the world of pleasure quarters, theater and fashion', ['the Buddhist world of sorrow only', 'the Pure Land paradise', 'the samurai battlefield'], 'Woodblock prints of it are ukiyo-e.'],
    ['Ihara Saikaku wrote', 'prose stories of townspeople’s love and money', ['Noh plays', 'haiku travel diaries', 'puppet plays'], 'Books of the floating world (ukiyo-zōshi).'],
    ['“What the Seasons Brought the Almanac Maker” ends with', 'the lovers caught and executed', ['a happy marriage', 'the merchant becoming shogun', 'a pilgrimage to Ise'], 'Passion collides with law.'],
    ['The Eternal Storehouse of Japan praises', 'thrift, hard work and cleverness in making money', ['samurai loyalty unto death', 'Zen detachment from wealth', 'imperial rule'], 'A merchant ethic, with humor.']
  ]),
  bank('chikamatsu', [
    ['Bunraku is', 'puppet theater with a chanter and shamisen', ['masked dance drama', 'all-male stage drama with live actors only', 'storytelling to the lute'], 'Each puppet takes three puppeteers.'],
    ['The Love Suicides at Sonezaki was written by', 'Chikamatsu Monzaemon', ['Ihara Saikaku', 'Zeami', 'Matsuo Bashō'], 'In 1703, from a real event.'],
    ['In Sonezaki, the lovers are', 'Tokubei and Ohatsu', ['Daisuke and Michiyo', 'Genji and Yūgao', 'Mikage and Yūichi'], 'A shop clerk and a courtesan.'],
    ['Tokubei is ruined when', 'his friend Kuheiji cheats him of money', ['the shogun exiles him', 'his shop burns down', 'he loses a battle'], 'Disgrace leaves no way out.'],
    ['The conflict in Chikamatsu’s domestic plays is often', 'giri (duty) against ninjō (human feeling)', ['Shinto against Buddhism', 'Japan against the West', 'city against country'], 'The lovers choose death to be together.'],
    ['Plays about ordinary townspeople are called', 'sewamono', ['jidaimono', 'zuihitsu', 'monogatari'], 'Jidaimono are history plays.']
  ]),
  bank('basho', [
    ['Besides 5-7-5, a classic haiku includes', 'a season word and a cutting word', ['a rhyme and a refrain', 'a moral and a title', 'a name and a date'], 'Kigo and kireji.'],
    ['Bashō’s most famous haiku is about', 'an old pond and a frog jumping in', ['cherry blossoms at dawn', 'a lemon on a pile of books', 'the bell of the Gion temple'], 'The sound of water breaks the stillness.'],
    ['The Narrow Road to the Deep North is', 'Bashō’s travel diary of prose and haiku', ['a Noh play', 'a novel by Sōseki', 'a Shinto chronicle'], 'From his 1689 journey.'],
    ['Bashō took his pen name from', 'the banana plant by his hut', ['his teacher', 'a famous samurai', 'a mountain'], 'Bashō means banana plant.'],
    ['In Bashō’s time, the 5-7-5 verse he wrote was called', 'hokku, the opening verse of linked verse', ['tanka', 'waka', 'sewamono'], 'The name "haiku" came in the 1890s.'],
    ['Late in life Bashō sought karumi, meaning', 'lightness', ['loyalty', 'darkness', 'purity'], 'Simple, everyday lightness of touch.']
  ]),
  bank('bakumatsu', [
    ['Commodore Perry’s black ships first arrived in', '1853', ['1868', '1603', '1894'], 'He returned in 1854 for the Treaty of Kanagawa.'],
    ['The unequal treaties gave Westerners', 'extraterritoriality and fixed Japanese tariffs', ['control of the emperor', 'all of Japan’s ports immediately', 'the right to vote in the Diet'], 'They were a deep humiliation.'],
    ['Sonnō jōi means', '"revere the emperor, expel the barbarians"', ['"rich country, strong army"', '"civilization and enlightenment"', '"Japanese spirit, Western technique"'], 'The anti-shogunate rallying cry.'],
    ['The domains that led the fight against the Tokugawa were', 'Satsuma and Chōshū', ['Edo and Osaka', 'Nara and Kyoto', 'Hokkaidō and Okinawa'], 'Their samurai later ran the Meiji government.'],
    ['"Bakumatsu" refers to', 'the end of the shogunate, 1853–1868', ['the founding of Kamakura', 'the Warring States period', 'the Occupation'], 'Literally "the end of the bakufu".']
  ]),
  bank('meiji', [
    ['The Meiji Restoration took place in', '1868', ['1853', '1889', '1912'], 'Power was "restored" to the emperor.'],
    ['After 1868 the capital moved to Edo, renamed', 'Tokyo', ['Kyoto', 'Osaka', 'Kamakura'], 'Tokyo means "eastern capital".'],
    ['"Fukoku kyōhei" means', '"rich country, strong army"', ['"revere the emperor"', '"civilization and enlightenment"', '"floating world"'], 'Industry and the military.'],
    ['The Meiji Constitution of 1889', 'created a Diet but kept sovereignty with the emperor', ['abolished the emperor', 'renounced war', 'gave women the vote'], 'Modeled partly on Prussia.'],
    ['Under Meiji, the samurai class', 'lost its privileges, and a conscript army replaced it', ['gained new estates', 'ran the shogunate', 'became merchants by law'], 'A rebellion in Satsuma (1877) was crushed.'],
    ['Japan defeated Russia in', '1904–05', ['1894–95', '1937', '1941'], 'It defeated China in 1894–95.']
  ]),
  bank('soseki', [
    ['And Then (Sorekara, 1909) was written by', 'Natsume Sōseki', ['Tanizaki Jun’ichirō', 'Kajii Motojirō', 'Nakamura Fuminori'], 'Translated by Norma Field.'],
    ['Daisuke lives on', 'his wealthy father’s money, refusing to work', ['his salary as a teacher', 'income from his novels', 'a samurai stipend'], 'His idleness is a critique of work.'],
    ['Daisuke loves Michiyo, who is', 'the wife of his friend Hiraoka', ['his cousin', 'a courtesan', 'his father’s choice of bride'], 'He had stepped aside for Hiraoka years before.'],
    ['When Daisuke chooses Michiyo, his father', 'disowns him', ['gives his blessing', 'gives him the family business', 'sends him to London'], 'He must go out to look for work.'],
    ['Sōseki thought Japan’s modernization was', 'forced from outside and superficial', ['complete and natural', 'harmful only to merchants', 'a return to Heian values'], 'It left people anxious and divided.'],
    ['Sōseki studied in', 'London', ['Paris', 'Berlin', 'New York'], 'From 1900 to 1902.']
  ]),
  bank('taisho', [
    ['The Taishō period lasted from', '1912 to 1926', ['1868 to 1912', '1926 to 1989', '1603 to 1868'], 'Between Meiji and Shōwa.'],
    ['Universal male suffrage came to Japan in', '1925', ['1868', '1947', '1889'], 'A high point of Taishō democracy.'],
    ['The Great Kantō Earthquake struck Tokyo in', '1923', ['1995', '1854', '1945'], 'Tokyo was rebuilt as a modern city.'],
    ['In Kajii’s “Lemon”, the narrator leaves the lemon', 'on a pile of art books in a bookstore, like a bomb', ['on Michiyo’s doorstep', 'at a Shinto shrine', 'in a teahouse'], 'The explosion is only imagined.'],
    ['The lemon in Kajii’s story stands for', 'pure sensation that lifts his gloom', ['the emperor’s authority', 'Western industry', 'a samurai’s honor'], 'Color, scent, coolness and weight.']
  ]),
  bank('tanizaki', [
    ['In Praise of Shadows was written by', 'Tanizaki Jun’ichirō', ['Natsume Sōseki', 'Yoshida Kenkō', 'Oshii Mamoru'], 'In 1933.'],
    ['Tanizaki argues that Japanese beauty lives in', 'shadow and dimness', ['bright electric light', 'bold primary colors', 'mass production'], 'Against Western brightness.'],
    ['Tanizaki says lacquerware is best seen', 'in candlelight', ['under electric light', 'in a museum case', 'outdoors at noon'], 'It glows in dim light.'],
    ['Tanizaki regrets the spread of', 'electric light and Western fixtures', ['Buddhism', 'haiku', 'tatami'], 'Though he admits he cannot do without them.'],
    ['The lecture title "Reactionary aesthetics?" asks whether the essay is', 'nostalgic or nationalist rather than simply about beauty', ['a scientific study', 'a translation from English', 'a novel'], 'It was written in the nationalist 1930s.']
  ]),
  bank('ww2', [
    ['Japan seized Manchuria in', '1931', ['1941', '1910', '1945'], 'The Manchurian Incident; Manchukuo followed.'],
    ['Full-scale war between Japan and China began in', '1937', ['1931', '1941', '1904'], 'The Marco Polo Bridge incident.'],
    ['Japan attacked Pearl Harbor on', 'December 7, 1941', ['August 6, 1945', 'September 18, 1931', 'July 7, 1937'], 'December 8 in Japan.'],
    ['The atomic bombs were dropped on Hiroshima and Nagasaki on', 'August 6 and August 9, 1945', ['August 15 and September 2, 1945', 'December 7 and 8, 1941', 'March 9 and 10, 1945'], 'Japan announced its surrender on August 15.'],
    ['The lecture title "Victimizers?" points to', 'Japan’s role as aggressor in Asia', ['Japan as victim of the bombs', 'the Mongol invasions', 'the samurai class'], 'The readings look at Chinese victims and Japanese soldiers.'],
    ['The Nanjing Massacre took place in', '1937–38', ['1941–42', '1945', '1931'], 'After Japan captured the Chinese capital.']
  ]),
  bank('hiroshima', [
    ['Grave of the Fireflies is set after', 'the firebombing of Kobe', ['the bombing of Hiroshima', 'the Great Kantō Earthquake', 'the Genpei War'], 'Seita and Setsuko starve.'],
    ['Grave of the Fireflies was directed by', 'Takahata Isao', ['Ōtomo Katsuhiro', 'Oshii Mamoru', 'Morita Yoshimitsu'], 'Studio Ghibli, 1988, from Nosaka’s story.'],
    ['Summer Flowers by Hara Tamiki is', 'a survivor’s account of the Hiroshima bombing', ['a haiku collection', 'a novel about the Occupation', 'a Noh play'], 'Published in 1947.'],
    ['Survivors of the atomic bombings are called', 'hibakusha', ['chōnin', 'samurai', 'kami'], 'Literally "bomb-affected people".'],
    ['The Enola Gay controversy (1995) concerned', 'a Smithsonian exhibit on the plane that bombed Hiroshima', ['a Japanese film banned in the US', 'a treaty ending the Occupation', 'a statue at Pearl Harbor'], 'Critics said it was too sympathetic to Japanese victims; it was cut back.'],
    ['Hiroshima-Nagasaki, August 1945 is made from', 'footage filmed by Japanese crews after the bombings', ['animation', 'reenactments with actors', 'American bomber cameras only'], 'The footage was long held by the US government.']
  ]),
  bank('occupation', [
    ['The Occupation of Japan was led by', 'General Douglas MacArthur', ['Commodore Perry', 'President Truman in person', 'Emperor Hirohito'], 'As Supreme Commander (SCAP).'],
    ['Article 9 of the 1947 constitution', 'renounces war', ['abolishes the emperor', 'creates the samurai class', 'bans Buddhism'], 'Japan keeps "Self-Defense Forces".'],
    ['In January 1946 the emperor', 'renounced his divinity', ['abdicated', 'was tried for war crimes', 'moved the capital'], 'He stayed on the throne as a symbol.'],
    ['The Occupation ended with the San Francisco Treaty in', '1952', ['1945', '1947', '1964'], 'Signed 1951, in effect 1952.'],
    ['Which was NOT an Occupation reform?', 'Restoring the shogunate', ['Women’s right to vote', 'Land reform', 'Article 9'], 'The shogunate ended in 1867.'],
    ['The 1964 Tokyo Olympics symbolized', 'Japan’s postwar economic recovery', ['the start of the Occupation', 'the Meiji Restoration', 'the bubble’s collapse'], 'Along with the bullet train.']
  ]),
  bank('hijiki', [
    ['“American Hijiki” was written by', 'Nosaka Akiyuki', ['Yoshimoto Banana', 'Hara Tamiki', 'Kojima Nobuo'], 'He also wrote "A Grave of Fireflies".'],
    ['The "American hijiki" was', 'black tea from American aid, mistaken for seaweed and cooked', ['canned whale meat', 'chocolate from GIs', 'a kind of rice'], 'A comic, bitter memory of Occupation hunger.'],
    ['In the story, Toshio hosts', 'an elderly American couple, the Higginses', ['General MacArthur', 'a Chinese soldier', 'his former tutor'], 'Their visit stirs his memories.'],
    ['Toshio’s attitude to his American guest is', 'a mix of servility and resentment', ['simple admiration', 'open hostility', 'complete indifference'], 'A portrait of mixed feelings toward the occupier.']
  ]),
  bank('familygame', [
    ['The Family Game was directed by', 'Morita Yoshimitsu', ['Takahata Isao', 'Oshii Mamoru', 'Ōtomo Katsuhiro'], 'In 1983.'],
    ['The family hires a tutor to', 'get the younger son through high-school entrance exams', ['teach the father English', 'run the family shop', 'write a novel'], 'The pressure of "exam hell".'],
    ['The film’s famous dinner scenes show the family', 'sitting side by side in a row, facing the camera', ['kneeling around a low table', 'eating in separate rooms', 'eating in a restaurant'], 'Together, yet never facing each other.'],
    ['Juken jigoku means', '"exam hell"', ['"floating world"', '"love suicide"', '"civilization and enlightenment"'], 'The pressure of entrance exams.']
  ]),
  bank('kitchen', [
    ['Kitchen (1988) was written by', 'Yoshimoto Banana', ['Murata Sayaka', 'Tanaka Yasuo', 'Murasaki Shikibu'], 'A huge bestseller.'],
    ['In Kitchen, Mikage finds comfort in', 'kitchens', ['temples', 'bookstores', 'trains'], 'Places of food and warmth.'],
    ['Eriko in Kitchen is', 'Yūichi’s mother, a transgender woman who was once his father', ['Mikage’s grandmother', 'a tutor', 'a pickpocket'], 'Part of a chosen family.'],
    ['Somehow, Crystal (1980) by Tanaka Yasuo is known for', 'hundreds of notes explaining brand names', ['its war scenes', 'its haiku', 'its Noh staging'], 'Consumer culture of the bubble years.'],
    ['The bubble economy burst around', '1990', ['1945', '1973', '2011'], 'Followed by the lost decade.']
  ]),
  bank('anime', [
    ['Akira (1988) was directed by', 'Ōtomo Katsuhiro', ['Oshii Mamoru', 'Takahata Isao', 'Morita Yoshimitsu'], 'From his own manga.'],
    ['Ghost in the Shell (1995) was directed by', 'Oshii Mamoru', ['Ōtomo Katsuhiro', 'Takahata Isao', 'Morita Yoshimitsu'], 'Based on Shirow Masamune’s manga.'],
    ['Akira is set in', 'Neo-Tokyo, 2019', ['Kyoto, 794', 'Edo, 1853', 'Hiroshima, 1945'], 'Rebuilt after a blast destroyed Tokyo.'],
    ['In Akira, the character whose body mutates out of control is', 'Tetsuo', ['Kaneda', 'Kusanagi', 'Toshio'], 'His psychic powers erupt.'],
    ['The "nuclear sublime" means', 'atomic destruction shown as awe-inspiring spectacle', ['a peaceful use of nuclear power', 'a haiku about the bomb', 'Tanizaki’s praise of shadows'], 'Horror and fascination at once.'],
    ['In Ghost in the Shell, the "shell" is', 'the artificial body; the "ghost" is the self or mind', ['a seashell symbol of the sea', 'a Shinto shrine', 'a puppet in bunraku'], 'Posthuman questions about identity.'],
    ['Susan Napier argues in "Why Anime?" that anime', 'deserves serious study for its themes and global reach', ['is only for children', 'is a passing fad', 'is copied from American cartoons'], 'Identity, the body, technology, apocalypse.']
  ]),
  bank('thief', [
    ['The Thief (2009) was written by', 'Nakamura Fuminori', ['Natsume Sōseki', 'Murata Sayaka', 'Nosaka Akiyuki'], 'It won the Ōe Kenzaburō Prize.'],
    ['The narrator of The Thief is', 'a skilled pickpocket in Tokyo', ['a samurai', 'a court lady', 'a cyborg agent'], 'His name is Nishimura.'],
    ['Kizaki in The Thief is', 'a crime boss who controls other people’s fates', ['a kind tutor', 'Nishimura’s father', 'a police detective'], 'A godlike figure of control.'],
    ['The "lost decade" refers to', 'Japan’s stagnation after the bubble burst', ['the decade of the Occupation', 'the Warring States period', 'the 1920s'], 'From the early 1990s.']
  ]),
  bank('murata', [
    ['Murata Sayaka is best known for the novel', 'Convenience Store Woman', ['Kitchen', 'The Thief', 'And Then'], 'Akutagawa Prize, 2016.'],
    ['In “Eating the City”, the narrator', 'gathers and eats wild plants growing in Tokyo', ['runs a restaurant', 'opens a convenience store', 'starves during the war'], 'It unsettles the line between nature and city.'],
    ['A theme that runs from the Hōjōki to “Eating the City” is', 'stepping outside ordinary society to see it freshly', ['the glory of war', 'the rise of the samurai', 'Confucian loyalty'], 'Recluses and outsiders see what others take for granted.']
  ]),
  { type: 'table', topic: 'timeline', columns: ['Period', 'Dates', 'Known for'],
    rows: [
      ['Jōmon', 'c. 14,000–300 BCE', 'cord-marked pottery made by hunter-gatherers'],
      ['Yayoi', 'c. 300 BCE–250 CE', 'wet-rice farming, bronze and iron'],
      ['Kofun', 'c. 250–538', 'keyhole-shaped burial mounds'],
      ['Nara', '710–794', 'the first permanent capital and the Great Buddha'],
      ['Heian', '794–1185', 'the court of The Tale of Genji'],
      ['Kamakura', '1185–1333', 'the first shogunate and the Mongol invasions'],
      ['Muromachi', '1336–1573', 'the Ashikaga shoguns, Noh and Zen arts'],
      ['Tokugawa (Edo)', '1603–1868', 'the long peace, the closed country and the floating world'],
      ['Meiji', '1868–1912', 'modernization under the restored emperor'],
      ['Taishō', '1912–1926', 'party politics, mass culture and modernism'],
      ['Shōwa', '1926–1989', 'war, defeat, occupation and the economic miracle'],
      ['Heisei', '1989–2019', 'the bubble’s collapse and the lost decades']
    ],
    asks: [
      { prompt: 'Which period is known for {{Known for}}?', answer: 'Period' },
      { prompt: 'When was the {{Period}} period?', answer: 'Dates' },
      { prompt: 'The {{Period}} period is best known for', answer: 'Known for' }
    ], options: 4, weight: 2 },
  { type: 'table', topic: 'works', columns: ['Work', 'Author or director', 'Form', 'Date'],
    rows: [
      ['The Tale of Genji', 'Murasaki Shikibu', 'court tale (monogatari)', 'early 1000s'],
      ['The Pillow Book', 'Sei Shōnagon', 'miscellany (zuihitsu)', 'around 1000'],
      ['Hōjōki', 'Kamo no Chōmei', 'recluse’s essay', '1212'],
      ['Essays in Idleness', 'Yoshida Kenkō', 'miscellany (zuihitsu)', 'about 1330'],
      ['Atsumori', 'Zeami', 'Noh play', 'about 1400'],
      ['The Eternal Storehouse of Japan', 'Ihara Saikaku', 'stories of townspeople', '1688'],
      ['The Love Suicides at Sonezaki', 'Chikamatsu Monzaemon', 'domestic puppet play', '1703'],
      ['The Narrow Road to the Deep North', 'Matsuo Bashō', 'travel diary with haiku', 'from a 1689 journey'],
      ['And Then', 'Natsume Sōseki', 'novel', '1909'],
      ['“Lemon”', 'Kajii Motojirō', 'short story', '1925'],
      ['In Praise of Shadows', 'Tanizaki Jun’ichirō', 'essay on aesthetics', '1933'],
      ['Summer Flowers', 'Hara Tamiki', 'survivor’s account', '1947'],
      ['“American Hijiki”', 'Nosaka Akiyuki', 'short story', '1967'],
      ['The Family Game', 'Morita Yoshimitsu', 'film', '1983'],
      ['Kitchen', 'Yoshimoto Banana', 'novella', '1988'],
      ['Akira', 'Ōtomo Katsuhiro', 'anime film', '1988'],
      ['Grave of the Fireflies', 'Takahata Isao', 'anime film', '1988'],
      ['Ghost in the Shell', 'Oshii Mamoru', 'anime film', '1995'],
      ['The Thief', 'Nakamura Fuminori', 'novel', '2009']
    ],
    asks: [
      { prompt: 'Who wrote or directed {{Work}}?', answer: 'Author or director' },
      { prompt: 'Which work is by {{Author or director}}?', answer: 'Work' },
      { prompt: 'When is {{Work}} from?', answer: 'Date' }
    ], options: 4, weight: 2 }
];

module.exports = { hint: 'Place the reading or event in its period first, then match the name.', topics, ladders, questions };
