import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const RECENTS_KEY = 'feedin_recent_emojis';
const MAX_RECENTS = 32;

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','🥹','😅','🤣','😂','🙂','🙃','😉','😊','😇',
      '🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝',
      '🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥',
      '😶‍🌫️','😏','😒','🙄','😬','😮‍💨','🤥','🫨','😌','😔','😪','🤤','😴','😷',
      '🤒','🤕','🤢','🤮','🥴','😵','😵‍💫','🤯','🤠','🥳','🥸','😎','🤓','🧐',
      '😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨',
      '😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡',
      '😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
      '😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    ],
  },
  {
    id: 'people',
    name: 'People & Body',
    icon: '👋',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','🫷','🫸','👌','🤌','🤏',
      '✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍',
      '👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅',
      '🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴',
      '👀','👁️','👅','👄','🫦','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩',
      '🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷',
    ],
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐱',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷',
      '🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆',
      '🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜',
      '🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐',
      '🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍',
      '🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖',
      '🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐈‍⬛','🪶','🐓','🦃','🦤',
      '🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️','🍀','🎍','🪴','🎋','🍃',
      '🍂','🍁','🪺','🪹','🍄','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍕',
    emojis: [
      '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓',
      '🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬',
      '🥦','🧄','🧅','🥜','🫘','🌰','🫚','🫛','🍞','🥐','🥖','🫓','🥨','🥯',
      '🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯',
      '🫔','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫',
      '🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡',
      '🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂',
      '🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🧃',
      '🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🫗','🍽️',
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒',
      '🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹',
      '🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🏇',
      '🧘','🏄','🏊','🤽','🚣','🧗','🚴','🚵','🎖️','🏆','🥇','🥈','🥉','🏅',
      '🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺',
      '🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🕹️','🧩','🪅','🪩','🪆',
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: '✈️',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜',
      '🏍️','🛵','🛺','🚲','🛴','🚏','🛣️','🛤️','🛞','⛽','🛑','🚨','🚥','🚦',
      '🚧','⚓','🛟','⛵','🛶','🚤','🛳️','⛴️','🛥️','🚢','✈️','🛩️','🛫','🛬',
      '🪂','💺','🚁','🚟','🚠','🚡','🛰️','🚀','🛸','🏠','🏡','🏘️','🏚️','🏗️',
      '🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌',
      '🕍','🛕','🕋','⛩️','🗾','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️',
      '🎠','🎡','🎢','🎪','🗼','🗽','🗿','🌁','🌃','🏙️','🌄','🌅','🌆','🌇',
      '🌉','🌌','🎆','🎇','🧨','🎑','🏮',
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '💡',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿',
      '📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻',
      '🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌',
      '💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳',
      '💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤',
      '🧱','⛓️','🧲','🔫','💣','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️',
      '🏺','🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','🩻','🩼',
      '💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰',
      '🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑',
      '🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎈','🎏','🎀',
      '🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥',
      '📤','📦','🏷️','🪧','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑',
      '🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋',
      '📁','📂','🗂️','🗞️','📰','📓','📔','📒','📕','📗','📘','📙','📚','📖',
      '🔖','🧷','🔗','📎','🖇️','📐','📏','🧮','📌','📍','✂️','🖊️','🖋️','✒️',
      '🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕',
      '💞','💓','💗','💖','💝','💘','💌','💋','👄','🫦','💍','💎','💐','🌹',
      '🥀','🌺','🌸','🌼','🌻','⭐','🌟','💫','✨','⚡','🔥','💥','☄️','🌈',
      '☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️',
      '💨','🌪️','🌫️','🌊','💧','💦','☔','☂️','🔴','🟠','🟡','🟢','🔵','🟣',
      '⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾',
      '◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','♈','♉',
      '♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛎','✅','❌','❓','❔',
      '‼️','⁉️','❗','〰️','💲','♻️','🔱','📛','🔰','⭕','✳️','❇️','🔆','🔅',
      '♾️','💠','🔘','🔳','🔲','🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️',
    ],
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: '🏳️',
    emojis: [
      '🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇵🇹','🇧🇷','🇲🇽','🇦🇷','🇨🇴','🇨🇱',
      '🇯🇵','🇰🇷','🇨🇳','🇮🇳','🇷🇺','🇹🇷','🇸🇦','🇦🇪','🇪🇬','🇳🇬','🇿🇦','🇰🇪',
      '🇦🇺','🇳🇿','🇨🇦','🇮🇪','🇳🇱','🇧🇪','🇨🇭','🇦🇹','🇸🇪','🇳🇴','🇩🇰','🇫🇮',
      '🇵🇱','🇺🇦','🇷🇴','🇬🇷','🇮🇱','🇹🇭','🇻🇳','🇵🇭','🇮🇩','🇲🇾','🇸🇬','🇵🇰',
    ],
  },
];

function getRecents(): string[] {
  try {
    const stored = localStorage.getItem(RECENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function addRecent(emoji: string) {
  const recents = getRecents().filter(e => e !== emoji);
  recents.unshift(emoji);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

interface EmojiKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

export const EmojiKeyboard = ({ isOpen, onClose, onSelectEmoji }: EmojiKeyboardProps) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState<string[]>(getRecents);

  // Refresh recents when opening
  useEffect(() => {
    if (isOpen) setRecents(getRecents());
  }, [isOpen]);

  const handleSelect = useCallback((emoji: string) => {
    addRecent(emoji);
    setRecents(getRecents());
    onSelectEmoji(emoji);
  }, [onSelectEmoji]);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: string[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const e of cat.emojis) {
        if (results.length >= 80) break;
        // Simple: just include all emojis that match Unicode or category name
        if (cat.name.toLowerCase().includes(q)) {
          results.push(e);
        }
      }
    }
    // If no category match, show all emojis (for simple search UX)
    if (results.length === 0) {
      for (const cat of EMOJI_CATEGORIES) {
        results.push(...cat.emojis);
        if (results.length >= 80) break;
      }
    }
    return results.slice(0, 80);
  }, [search]);

  const currentCategory = EMOJI_CATEGORIES.find(c => c.id === activeCategory) || EMOJI_CATEGORIES[0];

  const allTabs = [
    { id: 'recents', icon: <Clock className="w-4 h-4" /> },
    ...EMOJI_CATEGORIES.map(c => ({ id: c.id, icon: c.icon })),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 320 }}
          exit={{ opacity: 0, y: 20, height: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-card border-t border-border/50 overflow-hidden"
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search emoji..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Emoji grid */}
          <ScrollArea className="h-[240px]">
            {search.trim() && filteredEmojis ? (
              <div className="p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">Search Results</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {filteredEmojis.map((emoji, i) => (
                    <button
                      key={`search-${i}`}
                      onClick={() => handleSelect(emoji)}
                      className="flex items-center justify-center h-10 w-full rounded-lg hover:bg-muted/60 active:scale-90 transition-all text-2xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : activeCategory === 'recents' ? (
              <div className="p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">Recently Used</p>
                {recents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent emojis yet</p>
                ) : (
                  <div className="grid grid-cols-8 gap-0.5">
                    {recents.map((emoji, i) => (
                      <button
                        key={`recent-${i}`}
                        onClick={() => handleSelect(emoji)}
                        className="flex items-center justify-center h-10 w-full rounded-lg hover:bg-muted/60 active:scale-90 transition-all text-2xl"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">{currentCategory.name}</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {currentCategory.emojis.map((emoji, i) => (
                    <button
                      key={`${activeCategory}-${i}`}
                      onClick={() => handleSelect(emoji)}
                      className="flex items-center justify-center h-10 w-full rounded-lg hover:bg-muted/60 active:scale-90 transition-all text-2xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Category tabs at bottom */}
          <div className="flex items-center border-t border-border/30 overflow-x-auto no-scrollbar">
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveCategory(tab.id); setSearch(''); }}
                className={cn(
                  "flex items-center justify-center min-w-[40px] h-9 text-base transition-all",
                  activeCategory === tab.id
                    ? "bg-primary/10 border-b-2 border-primary"
                    : "hover:bg-muted/50"
                )}
              >
                {typeof tab.icon === 'string' ? tab.icon : tab.icon}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
