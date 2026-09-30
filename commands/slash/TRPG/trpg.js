const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const TRPG = require('../../../models/TRPG');
const Campaign = require('../../../models/TRPGCampaign');
const Monster = require('../../../models/TRPGMonster');

const RACES = {
    human: ['人類','👤',{str:1,dex:1,con:1,int:1,wis:1,cha:1},8],
    elf: ['精靈','🧝',{str:0,dex:2,con:0,int:1,wis:1,cha:0},6],
    dwarf: ['矮人','⛏️',{str:1,dex:0,con:2,int:0,wis:1,cha:0},11],
    orc: ['半獸人','👹',{str:2,dex:0,con:2,int:0,wis:0,cha:0},12],
    dragonborn: ['龍裔','🐉',{str:2,dex:0,con:1,int:0,wis:0,cha:1},10],
    tiefling: ['提夫林','😈',{str:0,dex:0,con:0,int:2,wis:0,cha:2},7]
};
const CLASSES = {
    warrior: ['戰士','⚔️','長劍','強力斬擊','STR','1d8',12],
    mage: ['法師','🔮','法杖','奧術飛彈','INT','1d10',7],
    rogue: ['盜賊','🗡️','匕首','背刺','DEX','1d6',8],
    paladin: ['聖騎士','🛡️','聖劍','神聖打擊','CHA','1d8',11],
    ranger: ['遊俠','🏹','長弓','精準射擊','DEX','1d8',9],
    cleric: ['牧師','✨','權杖','治癒祈禱','WIS','1d6',9]
};
const STATS = {str:'力量',dex:'敏捷',con:'體質',int:'智力',wis:'感知',cha:'魅力'};
const MONSTERS = [
    ['goblin','哥布林','👺','弱小但狡猾的森林怪物。',18,11,3,'1d6+1',35,20,1,['撕咬'],['破舊短劍']],
    ['skeleton','骷髏兵','💀','死而復生的戰士。',24,12,4,'1d6+2',45,28,2,['骨刃'],['骨劍']],
    ['wolf_alpha','狼群首領','🐺','統領狼群的兇猛野獸。',30,13,5,'1d8+2',60,40,3,['撲咬'],['獸皮']],
    ['orc_warrior','獸人戰士','👹','揮舞重斧的強大戰士。',38,14,6,'1d10+2',80,55,4,['重斬'],['獸人戰斧']],
    ['shadow_mage','暗影法師','🧙','操縱暗影魔法的施法者。',34,15,7,'1d8+3',90,70,5,['暗影箭'],['暗影水晶']],
    ['young_dragon','幼龍','🐲','尚未成年的巨龍，仍然極度危險。',55,16,8,'2d8+2',150,120,7,['吐息'],['龍鱗','龍牙']]
];
const SKILLS = {
    power_strike:{name:'強力斬擊',emoji:'⚔️',stat:'str',cost:0,damage:'1d10+2',desc:'近戰重擊，造成額外傷害。'},
    backstab:{name:'背刺',emoji:'🗡️',stat:'dex',cost:0,damage:'2d6',desc:'高爆發的敏捷攻擊。'},
    precise_shot:{name:'精準射擊',emoji:'🏹',stat:'dex',cost:0,damage:'1d10+3',desc:'提高遠程命中與傷害。'},
    holy_strike:{name:'神聖打擊',emoji:'🛡️',stat:'cha',cost:5,damage:'2d8',desc:'消耗 MP 的神聖攻擊。'},
    arcane_missile:{name:'奧術飛彈',emoji:'🔮',stat:'int',cost:5,damage:'2d8',desc:'必中魔法飛彈。'},
    heal_prayer:{name:'治癒祈禱',emoji:'✨',stat:'wis',cost:5,damage:'1d8',desc:'恢復自身 HP。'}
};
const SPELLS = {
    fireball:{name:'火球術',emoji:'🔥',stat:'int',cost:8,damage:'3d6',desc:'範圍火焰魔法。'},
    ice_lance:{name:'冰槍術',emoji:'❄️',stat:'int',cost:6,damage:'2d8',desc:'寒冰長槍。'},
    thunder:{name:'雷擊',emoji:'⚡',stat:'wis',cost:7,damage:'2d10',desc:'召喚雷電攻擊敵人。'},
    heal:{name:'治療術',emoji:'💚',stat:'wis',cost:6,damage:'2d8',desc:'恢復自身生命。'}
};
const SHOP = {
    potion:{name:'治療藥水',type:'consumable',price:30,effect:15,description:'恢復 15 HP。'},
    ether:{name:'魔力藥水',type:'consumable',price:35,effect:10,description:'恢復 10 MP。'},
    iron_sword:{name:'鐵劍',type:'weapon',price:120,power:2,slot:'weapon',description:'裝備後近戰傷害 +2。'},
    steel_armor:{name:'鋼製護甲',type:'armor',price:180,power:3,slot:'armor',description:'裝備後 AC +3。'},
    lucky_ring:{name:'幸運戒指',type:'accessory',price:250,power:1,slot:'accessory',description:'裝備後全屬性檢定 +1。'}
};
const QUESTS = [
    {id:'forest',title:'🌲 森林清剿',description:'擊敗森林中的怪物。',rewardXp:80,rewardGold:100},
    {id:'skeleton',title:'💀 骨骸之謎',description:'調查骷髏兵出沒的原因。',rewardXp:120,rewardGold:150},
    {id:'dragon',title:'🐲 龍巢遠征',description:'前往龍巢並擊敗幼龍。',rewardXp:250,rewardGold:300}
];
const ACHIEVEMENTS = [
    ['first_blood','⚔️ 初次勝利','完成第一場戰鬥',50,25],
    ['rich','💰 小富翁','持有 500 金幣',100,100],
    ['level5','🌟 冒險家','達到 5 級',200,150],
    ['dragon_slayer','🐲 屠龍者','擊敗幼龍',300,300],
    ['quester','📜 任務達人','完成 3 個任務',250,200]
];

const d = n => Math.floor(Math.random() * n) + 1;
const mod = n => Math.floor((n - 10) / 2);
const signed = n => n >= 0 ? '+' + n : String(n);
function roll(expr) {
    const m = String(expr).trim().toLowerCase().match(/^(\d{1,2})d(\d{1,4})([+-]\d{1,4})?$/);
    if (!m) throw new Error('骰子格式必須是 1d20、2d6+3 等。');
    const count=+m[1], sides=+m[2], bonus=+(m[3]||0);
    if(count<1||count>20||sides<2||sides>1000) throw new Error('骰子最多 20 顆、每顆最多 1000 面。');
    const rolls=Array.from({length:count},()=>d(sides));
    return {rolls,total:rolls.reduce((a,b)=>a+b,0)+bonus,bonus};
}
function statRoll(){const a=Array.from({length:4},()=>d(6)).sort((a,b)=>a-b);return {dice:a,total:a[1]+a[2]+a[3]};}
function item(c,name){return c.inventory.find(x=>x.name===name);}
function xpBar(c){const max=c.getXpToNextLevel(),n=Math.round(Math.min(c.exp,max)/max*10);return '█'.repeat(n)+'░'.repeat(10-n);}
function charEmbed(c,u,title){
    const attrs=Object.entries(STATS).map(([k,v])=>`**${v} (${k.toUpperCase()})** ${c.attributes[k]} (${signed(c.getModifier(k))})`).join('\n');
    return new EmbedBuilder().setColor('#A855F7').setTitle(title||`${c.class.emoji} ${c.name}`)
        .setDescription(`${c.race.emoji} **${c.race.name}** · ${c.class.emoji} **${c.class.name}** · Lv.${c.level}\nXP **${c.exp}/${c.getXpToNextLevel()}**\n${xpBar(c)}`)
        .addFields(
            {name:'❤️ 生命 / 魔力',value:`**${c.hp}/${c.maxHp} HP** · **${c.mp}/${c.maxMp} MP**\n🛡️ AC **${c.ac}**`,inline:true},
            {name:'💰 財富',value:`**${c.gold||0}** 金幣`,inline:true},
            {name:'⚔️ 戰鬥',value:`${c.class.weapon||'徒手'} · ${c.class.damage||'1d6'}\n${c.class.skill||'無'}`,inline:true},
            {name:'📊 屬性',value:attrs},
            {name:'🎒 裝備',value:`武器：${c.equipment?.weapon||'無'}\n護甲：${c.equipment?.armor||'無'}\n飾品：${c.equipment?.accessory||'無'}`},
            {name:'🏆 戰績',value:`勝場 ${c.victories||0} · 敗場 ${c.defeats||0} · 任務 ${c.questsCompleted||0}`}
        ).setThumbnail(u.displayAvatarURL({size:256})).setFooter({text:`角色擁有者：${u.username}`}).setTimestamp();
}
async function findChar(i,name,userId=i.user.id){
    const cs=await TRPG.find({userId}).sort({createdAt:1});
    if(!cs.length)throw new Error('找不到角色。請先使用 /trpg character create。');
    if(name){const c=cs.find(x=>x.name.toLowerCase()===name.toLowerCase());if(!c)throw new Error(`找不到角色「${name}」。`);return c;}
    return cs[0];
}
async function seedMonsters(){for(const x of MONSTERS)await Monster.updateOne({key:x[0]},{$set:{key:x[0],name:x[1],emoji:x[2],description:x[3],hp:x[4],ac:x[5],attack:x[6],damage:x[7],xp:x[8],gold:x[9],level:x[10],skills:x[11],loot:x[12]}},{upsert:true});}
function campaignByName(i,name){return Campaign.findOne({guildId:i.guildId,...(name?{name}:{}),status:{$ne:'ended'}});}
function isGM(c,i){return c && c.gmId===i.user.id;}
function getMember(c,userId){return c?.party?.find(m=>m.userId===userId);}
async function awardAchievements(c){
    const checks=[];
    if((c.victories||0)>=1)checks.push('first_blood');
    if((c.gold||0)>=500)checks.push('rich');
    if(c.level>=5)checks.push('level5');
    if((c.questsCompleted||0)>=3)checks.push('quester');
    for(const key of checks){
        if(c.achievements.includes(key))continue;
        const a=ACHIEVEMENTS.find(x=>x[0]===key);if(!a)continue;
        c.achievements.push(key);c.gold+=a[4];c.exp+=a[3];
    }
}

module.exports={
    category:'TRPG',
    data:new SlashCommandBuilder().setName('trpg').setDescription('🎲 完整 TRPG 冒險系統').setDMPermission(false)
    .addSubcommandGroup(g=>g.setName('core').setDescription('🎲 核心冒險')
        .addSubcommand(s=>s.setName('roll').setDescription('擲骰子').addStringOption(o=>o.setName('dice').setDescription('例如 1d20、2d6+3').setRequired(true)))
        .addSubcommand(s=>s.setName('check').setDescription('D20 屬性檢定').addStringOption(o=>o.setName('stat').setDescription('屬性').setRequired(true).addChoices(...Object.entries(STATS).map(([v,n])=>({name:`${n} (${v.toUpperCase()})`,value:v})))).addIntegerOption(o=>o.setName('dc').setDescription('DC').setMinValue(1).setMaxValue(40)).addStringOption(o=>o.setName('name').setDescription('角色名稱')))
        .addSubcommand(s=>s.setName('battle').setDescription('隨機遭遇戰').addStringOption(o=>o.setName('name').setDescription('角色名稱')))
        .addSubcommand(s=>s.setName('heal').setDescription('使用治療藥水').addStringOption(o=>o.setName('name').setDescription('角色名稱')))
        .addSubcommand(s=>s.setName('rest').setDescription('完全休息').addStringOption(o=>o.setName('name').setDescription('角色名稱')))
        .addSubcommand(s=>s.setName('inventory').setDescription('查看背包').addStringOption(o=>o.setName('name').setDescription('角色名稱')))
        .addSubcommand(s=>s.setName('achievement').setDescription('查看成就').addStringOption(o=>o.setName('name').setDescription('角色名稱'))))
    .addSubcommandGroup(g=>g.setName('character').setDescription('🎭 角色卡管理')
        .addSubcommand(s=>s.setName('create').setDescription('建立角色').addStringOption(o=>o.setName('name').setDescription('角色名稱'))
            .addStringOption(o=>o.setName('race').setDescription('種族').addChoices(...Object.entries(RACES).map(([v,x])=>({name:`${x[1]} ${x[0]}`,value:v}))))
            .addStringOption(o=>o.setName('class').setDescription('職業').addChoices(...Object.entries(CLASSES).map(([v,x])=>({name:`${x[1]} ${x[0]}`,value:v})))))
        .addSubcommand(s=>s.setName('list').setDescription('查看你的所有角色'))
        .addSubcommand(s=>s.setName('view').setDescription('查看角色').addStringOption(o=>o.setName('name').setDescription('角色名稱')).addUserOption(o=>o.setName('user').setDescription('查看其他玩家')))
        .addSubcommand(s=>s.setName('delete').setDescription('永久刪除角色').addStringOption(o=>o.setName('name').setDescription('角色名稱').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('campaign').setDescription('🏰 Campaign 冒險團')
        .addSubcommand(s=>s.setName('create').setDescription('建立 Campaign').addStringOption(o=>o.setName('name').setDescription('Campaign 名稱').setRequired(true)).addStringOption(o=>o.setName('description').setDescription('冒險簡介')))
        .addSubcommand(s=>s.setName('list').setDescription('查看 Campaign'))
        .addSubcommand(s=>s.setName('join').setDescription('加入 Campaign').addStringOption(o=>o.setName('name').setDescription('Campaign 名稱').setRequired(true)).addStringOption(o=>o.setName('character').setDescription('角色名稱')))
        .addSubcommand(s=>s.setName('leave').setDescription('離開 Campaign').addStringOption(o=>o.setName('name').setDescription('Campaign 名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('start').setDescription('GM 開始冒險').addStringOption(o=>o.setName('name').setDescription('Campaign 名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('end').setDescription('GM 結束冒險').addStringOption(o=>o.setName('name').setDescription('Campaign 名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('info').setDescription('查看 Campaign').addStringOption(o=>o.setName('name').setDescription('Campaign 名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('story').setDescription('GM 推進章節').addStringOption(o=>o.setName('name').setDescription('Campaign 名稱').setRequired(true)).addStringOption(o=>o.setName('text').setDescription('劇情內容').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('gm').setDescription('🎭 GM 管理')
        .addSubcommand(s=>s.setName('set').setDescription('指定 GM').addUserOption(o=>o.setName('user').setDescription('GM 玩家').setRequired(true)).addStringOption(o=>o.setName('campaign').setDescription('Campaign 名稱').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('party').setDescription('👥 組隊')
        .addSubcommand(s=>s.setName('view').setDescription('查看隊伍').addStringOption(o=>o.setName('campaign').setDescription('Campaign 名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('kick').setDescription('GM 移除隊員').addUserOption(o=>o.setName('user').setDescription('隊員').setRequired(true)).addStringOption(o=>o.setName('campaign').setDescription('Campaign 名稱').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('map').setDescription('🗺️ 地圖')
        .addSubcommand(s=>s.setName('view').setDescription('查看地圖').addStringOption(o=>o.setName('campaign').setDescription('Campaign 名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('move').setDescription('移動探索').addStringOption(o=>o.setName('direction').setDescription('方向').setRequired(true).addChoices({name:'⬆️ 北',value:'north'},{name:'⬇️ 南',value:'south'},{name:'⬅️ 西',value:'west'},{name:'➡️ 東',value:'east'})).addStringOption(o=>o.setName('campaign').setDescription('Campaign 名稱').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('monster').setDescription('👾 怪物資料庫')
        .addSubcommand(s=>s.setName('list').setDescription('怪物列表'))
        .addSubcommand(s=>s.setName('view').setDescription('怪物資料').addStringOption(o=>o.setName('key').setDescription('怪物代號').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('skill').setDescription('⚔️ 技能')
        .addSubcommand(s=>s.setName('list').setDescription('技能列表'))
        .addSubcommand(s=>s.setName('use').setDescription('使用技能').addStringOption(o=>o.setName('skill').setDescription('技能代號').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('spell').setDescription('🧙 法術')
        .addSubcommand(s=>s.setName('list').setDescription('法術列表'))
        .addSubcommand(s=>s.setName('cast').setDescription('施放法術').addStringOption(o=>o.setName('spell').setDescription('法術代號').setRequired(true))))
    .addSubcommandGroup(g=>g.setName('equipment').setDescription('🎒 裝備')
        .addSubcommand(s=>s.setName('list').setDescription('查看裝備'))
        .addSubcommand(s=>s.setName('equip').setDescription('裝備物品').addStringOption(o=>o.setName('item').setDescription('物品名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('unequip').setDescription('卸下裝備').addStringOption(o=>o.setName('slot').setDescription('欄位').setRequired(true).addChoices({name:'武器',value:'weapon'},{name:'護甲',value:'armor'},{name:'飾品',value:'accessory'}))))
    .addSubcommandGroup(g=>g.setName('shop').setDescription('💰 商店')
        .addSubcommand(s=>s.setName('list').setDescription('查看商店'))
        .addSubcommand(s=>s.setName('buy').setDescription('購買物品').addStringOption(o=>o.setName('item').setDescription('物品代號').setRequired(true)).addIntegerOption(o=>o.setName('quantity').setDescription('數量').setMinValue(1).setMaxValue(99)))
        .addSubcommand(s=>s.setName('sell').setDescription('出售物品').addStringOption(o=>o.setName('item').setDescription('物品名稱').setRequired(true)).addIntegerOption(o=>o.setName('quantity').setDescription('數量').setMinValue(1).setMaxValue(99))))
    .addSubcommandGroup(g=>g.setName('quest').setDescription('📜 任務')
        .addSubcommand(s=>s.setName('list').setDescription('任務列表').addStringOption(o=>o.setName('campaign').setDescription('Campaign 名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('accept').setDescription('接受任務').addStringOption(o=>o.setName('id').setDescription('任務代號').setRequired(true)).addStringOption(o=>o.setName('campaign').setDescription('Campaign 名稱').setRequired(true)))
        .addSubcommand(s=>s.setName('complete').setDescription('完成目前任務').addStringOption(o=>o.setName('campaign').setDescription('Campaign 名稱').setRequired(true)))),

    async execute(i){
        try{
            if(!i.guildId)return i.reply({content:'❌ TRPG 只能在伺服器使用。',ephemeral:true});
            const g=i.options.getSubcommandGroup(false),s=i.options.getSubcommand();
            if(g==='core')return core(i,s);\n            if(g==='character')return character(i,s);
            if(g==='campaign')return campaign(i,s);
            if(g==='gm')return gm(i);
            if(g==='party')return party(i,s);
            if(g==='map')return mapCmd(i,s);
            if(g==='monster')return monster(i,s);
            if(g==='skill')return skill(i,s);
            if(g==='spell')return spell(i,s);
            if(g==='equipment')return equipment(i,s);
            if(g==='shop')return shop(i,s);
            if(g==='quest')return quest(i,s);
            if(s==='roll')return dice(i);
            if(s==='check')return check(i);
            if(s==='battle')return battle(i);
            if(s==='heal')return heal(i);
            if(s==='rest')return rest(i);
            if(s==='inventory')return inventory(i);
            if(s==='achievement')return achievement(i);
        }catch(e){
            console.error('TRPG error:',e);
            const fn=i.replied||i.deferred?'followUp':'reply';
            return i[fn]({content:`❌ ${e.message}`,ephemeral:true}).catch(()=>null);
        }
    }
};

async function core(i,s){\n    if(s==='roll')return dice(i); if(s==='check')return check(i); if(s==='battle')return battle(i); if(s==='heal')return heal(i); if(s==='rest')return rest(i); if(s==='inventory')return inventory(i); if(s==='achievement')return achievement(i);\n}\nasync function character(i,s){
    if(s==='create'){
        const name=(i.options.getString('name')||`冒險者・${i.user.username}`).trim();
        const rk=i.options.getString('race')||Object.keys(RACES)[d(Object.keys(RACES).length)-1];
        const ck=i.options.getString('class')||Object.keys(CLASSES)[d(Object.keys(CLASSES).length)-1];
        if(name.length>24)throw new Error('角色名稱最多 24 個字。');
        if(await TRPG.exists({userId:i.user.id,name}))throw new Error('你已有同名角色。');
        const r=RACES[rk],c=CLASSES[ck],attrs={},details=[];
        for(const k of Object.keys(STATS)){const x=statRoll();attrs[k]=Math.min(20,x.total+r[2][k]);details.push(`${STATS[k]} ${attrs[k]} [${x.dice.join(',')}]`);}
        const hp=c[6]+r[3]+Math.max(0,mod(attrs.con)*2),mp=10+Math.max(0,mod(attrs.int));
        const char=new TRPG({userId:i.user.id,guildId:i.guildId,name,race:{name:r[0],emoji:r[1]},class:{name:c[0],emoji:c[1],weapon:c[2],skill:c[3],proficiency:c[4],damage:c[5]},attributes:attrs,hp,maxHp:hp,mp,maxMp:mp,ac:10+Math.max(0,mod(attrs.dex)),gold:100,inventory:[{name:'治療藥水',type:'consumable',quantity:3,effect:10,description:'恢復 10 HP'}],skills:Object.keys(SKILLS).filter(k=>SKILLS[k].name===c[3]),spells:c[0]==='法師'?['fireball','ice_lance']:c[0]==='牧師'?['thunder','heal']:[]});
        await char.save();const e=charEmbed(char,i.user,'✨ 角色建立成功');e.addFields({name:'🎲 初始屬性',value:details.join('\n').slice(0,1024)});return i.reply({embeds:[e]});
    }
    if(s==='list'){const cs=await TRPG.find({userId:i.user.id}).sort({createdAt:1});if(!cs.length)return i.reply({content:'📭 你目前沒有角色卡。',ephemeral:true});return i.reply({embeds:[new EmbedBuilder().setColor('#8B5CF6').setTitle('🎭 我的角色').setDescription(cs.map((c,n)=>`${n+1}. ${c.class.emoji} **${c.name}** · Lv.${c.level} · ❤️ ${c.hp}/${c.maxHp} · 🏆 ${c.victories||0}`).join('\n'))]});}
    if(s==='view'){const u=i.options.getUser('user')||i.user,c=await findChar(i,i.options.getString('name'),u.id);return i.reply({embeds:[charEmbed(c,u)]});}
    if(s==='delete'){const c=await findChar(i,i.options.getString('name'));await TRPG.deleteOne({_id:c.id,userId:i.user.id});return i.reply({content:`🪦 **${c.name}** 已刪除。`});}
}
async function dice(i){const x=roll(i.options.getString('dice'));return i.reply({embeds:[new EmbedBuilder().setColor('#F59E0B').setTitle('🎲 骰子結果').setDescription(`${i.options.getString('dice')} → [${x.rolls.join(', ')}] = **${x.total}**`)]});}
async function check(i){const c=await findChar(i,i.options.getString('name')),stat=i.options.getString('stat'),dc=i.options.getInteger('dc')||10,r=d(20),m=c.getModifier(stat),total=r+m,ok=r===20||(r!==1&&total>=dc);return i.reply({embeds:[new EmbedBuilder().setColor(ok?'#22C55E':'#EF4444').setTitle(r===20?'🌟 大成功！':r===1?'💥 大失敗！':ok?'✅ 檢定成功':'❌ 檢定失敗').setDescription(`**${c.name}** · ${STATS[stat]}\n🎲 ${r} ${signed(m)} = **${total}** · DC **${dc}**`)]});}
async function heal(i){const c=await findChar(i,i.options.getString('name'));const p=item(c,'治療藥水');if(c.hp>=c.maxHp)return i.reply({content:'❤️ HP 已滿。',ephemeral:true});if(!p||p.quantity<1)return i.reply({content:'🧪 沒有治療藥水。',ephemeral:true});const n=Math.min(p.effect||10,c.maxHp-c.hp);c.hp+=n;p.quantity--;c.inventory=c.inventory.filter(x=>x.quantity>0);await c.save();return i.reply({content:`🧪 **${c.name}** 恢復 **${n} HP**。`});}
async function rest(i){const c=await findChar(i,i.options.getString('name'));const old=c.hp;c.hp=c.maxHp;c.mp=c.maxMp;c.lastRestAt=new Date();await c.save();return i.reply({content:`🛏️ **${c.name}** 完全休息，恢復 ${c.hp-old} HP、${c.mp} MP。`});}
async function inventory(i){const c=await findChar(i,i.options.getString('name'));const t=c.inventory.length?c.inventory.map(x=>`**${x.name}** ×${x.quantity} — ${x.description||x.type}`).join('\n'):'背包是空的。';return i.reply({embeds:[new EmbedBuilder().setColor('#14B8A6').setTitle(`🎒 ${c.name} 的背包`).setDescription(t.slice(0,4096)).addFields({name:'💰 金幣',value:String(c.gold||0),inline:true})]});}

async function battle(i){
    const c=await findChar(i,i.options.getString('name'));if(c.hp<=0)return i.reply({content:'💀 角色倒下了，請先 /trpg rest。',ephemeral:true});
    await seedMonsters();const docs=await Monster.find({});const m=docs[d(docs.length)-1];const enemy={...m.toObject(),maxHp:m.hp};
    const view=extra=>new EmbedBuilder().setColor('#EF4444').setTitle(`⚔️ ${enemy.emoji} ${enemy.name}`).setDescription(`**${c.name}** Lv.${c.level}\n❤️ 你：**${c.hp}/${c.maxHp}** · 💧 MP **${c.mp}/${c.maxMp}**\n\n${enemy.emoji} **${enemy.name}**\n❤️ 敵人：**${enemy.hp}/${enemy.maxHp}** · 🛡️ AC ${enemy.ac}${extra?'\n\n'+extra:''}`);
    const row=()=>[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trpg_b_atk').setLabel('⚔️ 攻擊').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId('trpg_b_skill').setLabel('✨ 技能').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('trpg_b_pot').setLabel('🧪 藥水').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('trpg_b_run').setLabel('🏃 逃跑').setStyle(ButtonStyle.Secondary))];
    await i.reply({embeds:[view()],components:row()});const msg=await i.fetchReply(),col=msg.createMessageComponentCollector({time:180000});
    col.on('collect',async b=>{if(b.user.id!==i.user.id)return b.reply({content:'❌ 這場戰鬥不是你的。',ephemeral:true});try{
        let last='';
        if(b.customId==='trpg_b_run'){col.stop('flee');return b.update({embeds:[new EmbedBuilder().setColor('#64748B').setTitle('🏃 逃跑成功').setDescription(`**${c.name}** 離開戰場。`)],components:[]});}
        if(b.customId==='trpg_b_pot'){const p=item(c,'治療藥水');if(!p||p.quantity<1)return b.reply({content:'🧪 沒有藥水。',ephemeral:true});const n=Math.min(p.effect||10,c.maxHp-c.hp);c.hp+=n;p.quantity--;c.inventory=c.inventory.filter(x=>x.quantity>0);last=`🧪 恢復 ${n} HP。`;}
        else if(b.customId==='trpg_b_skill'){const key=c.skills.find(k=>SKILLS[k]);if(!key)return b.reply({content:'❌ 角色沒有可用技能。',ephemeral:true});const sk=SKILLS[key];if(c.mp<sk.cost)return b.reply({content:'💧 MP 不足。',ephemeral:true});c.mp-=sk.cost;if(key==='heal_prayer'){const n=roll(sk.damage).total+c.getModifier(sk.stat);c.hp=Math.min(c.maxHp,c.hp+n);last=`✨ 治癒祈禱恢復 ${n} HP。`;}else{const ar=d(20)+c.getModifier(sk.stat);if(ar>=enemy.ac||key==='arcane_missile'){const dmg=roll(sk.damage).total+c.getModifier(sk.stat);enemy.hp=Math.max(0,enemy.hp-dmg);last=`${sk.emoji} ${sk.name} 命中，造成 **${dmg}** 傷害。`;}else last=`❌ ${sk.name} 未命中。`;}}
        else {const ar=d(20)+c.getModifier(c.class.proficiency.toLowerCase());if(ar>=enemy.ac){const dmg=Math.max(1,roll(c.class.damage).total);enemy.hp=Math.max(0,enemy.hp-dmg);last=`⚔️ 命中造成 **${dmg}** 傷害。`;}else last='❌ 攻擊未命中。';}
        if(enemy.hp<=0){c.victories++;c.exp+=enemy.xp;c.gold+=enemy.gold;c.inventory.push(...enemy.loot.map(name=>({name,type:'loot',quantity:1,description:'戰利品'})));if(enemy.key==='young_dragon'&&!c.achievements.includes('dragon_slayer'))c.achievements.push('dragon_slayer');if(c.exp>=c.getXpToNextLevel()){c.exp-=c.getXpToNextLevel();c.level++;c.maxHp+=5;c.maxMp+=2;c.hp=c.maxHp;c.mp=c.maxMp;last+='\n🎉 升級！';}await awardAchievements(c);await c.save();col.stop('win');return b.update({embeds:[new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 戰鬥勝利！').setDescription(`${last}\n⭐ +${enemy.xp} XP · 💰 +${enemy.gold} 金幣`)],components:[]});}
        if(b.customId!=='trpg_b_pot'&&b.customId!=='trpg_b_skill' || enemy.hp>0){const er=d(20)+enemy.attack;if(er>=c.ac){const dmg=roll(enemy.damage).total;c.hp=Math.max(0,c.hp-dmg);last+=`\n${enemy.emoji} 反擊造成 **${dmg}** 傷害。`;}}
        if(c.hp<=0){c.defeats++;await c.save();col.stop('dead');return b.update({embeds:[new EmbedBuilder().setColor('#111827').setTitle('💀 角色倒下').setDescription(`${last}\n**${c.name}** 被擊倒了，請 /trpg rest。`)],components:[]});}
        await c.save();return b.update({embeds:[view(last)],components:row()});
    }catch(e){return b.reply({content:`❌ ${e.message}`,ephemeral:true}).catch(()=>null);}});
    col.on('end',(_,reason)=>{if(!['win','dead','flee'].includes(reason))i.editReply({components:[]}).catch(()=>{});});
}

async function campaign(i,s){
    const name=i.options.getString('name');
    if(s==='create'){const n=name,dsc=i.options.getString('description')||'一場新的冒險。';if(await Campaign.exists({guildId:i.guildId,name:n}))throw new Error('同名 Campaign 已存在。');const c=await findChar(i,null);const camp=new Campaign({guildId:i.guildId,name:n,description:dsc,gmId:i.user.id,party:[{userId:i.user.id,characterId:c._id,role:'gm'}],quests:QUESTS.map(q=>({...q}))});await camp.save();c.activeCampaignId=camp._id;await c.save();return i.reply({embeds:[new EmbedBuilder().setColor('#7C3AED').setTitle('🏰 Campaign 建立成功').setDescription(`**${n}**\nGM：<@${i.user.id}>\n已自動加入你的角色 **${c.name}**。`)]});}
    if(s==='list'){const cs=await Campaign.find({guildId:i.guildId,status:{$ne:'ended'}});return i.reply({embeds:[new EmbedBuilder().setTitle('🏰 Campaign 列表').setDescription(cs.length?cs.map(c=>`**${c.name}** · ${c.status==='active'?'🟢 進行中':'🟡 大廳'} · 第 ${c.chapter} 章 · ${c.party.length} 人`).join('\n'):'目前沒有 Campaign。')]});}
    const camp=await Campaign.findOne({guildId:i.guildId,name:n});if(!camp)throw new Error('找不到 Campaign。');
    if(s==='join'){const c=await findChar(i,i.options.getString('character'));if(getMember(camp,i.user.id))throw new Error('你已經在隊伍中。');if(camp.status==='ended')throw new Error('Campaign 已結束。');camp.party.push({userId:i.user.id,characterId:c._id,role:'player'});c.activeCampaignId=camp._id;await Promise.all([camp.save(),c.save()]);return i.reply(`👥 **${c.name}** 加入 **${camp.name}**！`);}
    if(s==='leave'){const m=getMember(camp,i.user.id);if(!m)throw new Error('你不在這個隊伍。');if(m.role==='gm')throw new Error('GM 請先使用 /trpg campaign end 或 /trpg gm set。');camp.party=camp.party.filter(x=>x.userId!==i.user.id);await camp.save();await TRPG.updateOne({_id:m.characterId},{$set:{activeCampaignId:null}});return i.reply('👋 已離開 Campaign。');}
    if(s==='start'){if(!isGM(camp,i))throw new Error('只有 GM 可以開始。');camp.status='active';await camp.save();return i.reply(`🎬 **${camp.name}** 正式開始！第 1 章：${camp.location}`);}
    if(s==='end'){if(!isGM(camp,i))throw new Error('只有 GM 可以結束。');camp.status='ended';await camp.save();return i.reply(`🏁 **${camp.name}** 已結束。`);}
    if(s==='info'){const members=camp.party.map(m=>`<@${m.userId}> · ${m.role==='gm'?'🎭 GM':'🎲 玩家'}`).join('\n');return i.reply({embeds:[new EmbedBuilder().setColor('#6366F1').setTitle(`🏰 ${camp.name}`).setDescription(camp.description||'').addFields({name:'狀態',value:`${camp.status} · 第 ${camp.chapter} 章`,inline:true},{name:'📍 位置',value:camp.location,inline:true},{name:'👥 隊伍',value:members||'無'})]});}
    if(s==='story'){if(!isGM(camp,i))throw new Error('只有 GM 可以推進劇情。');camp.chapter++;camp.storyLog.push(`第 ${camp.chapter} 章：${i.options.getString('text')}`);camp.location=i.options.getString('text').slice(0,80);await camp.save();return i.reply(`📖 **第 ${camp.chapter} 章**\n${i.options.getString('text')}`);}
}
async function gm(i){const user=i.options.getUser('user'),name=i.options.getString('campaign'),camp=await Campaign.findOne({guildId:i.guildId,name});if(!camp)throw new Error('找不到 Campaign。');if(camp.gmId!==i.user.id&& !i.memberPermissions?.has?.('ManageGuild'))throw new Error('只有目前 GM 或伺服器管理員可以換 GM。');const target=getMember(camp,user.id);if(!target)throw new Error('該玩家不在隊伍中。');camp.party.forEach(m=>m.role=m.userId===user.id?'gm':(m.role==='gm'?'player':'player'));camp.gmId=user.id;await camp.save();return i.reply(`🎭 <@${user.id}> 現在是 **${camp.name}** 的 GM。`);}
async function party(i,s){const name=i.options.getString('campaign'),camp=await Campaign.findOne({guildId:i.guildId,name});if(!camp)throw new Error('找不到 Campaign。');if(s==='kick'){if(!isGM(camp,i))throw new Error('只有 GM 可以踢人。');const u=i.options.getUser('user');camp.party=camp.party.filter(m=>m.userId!==u.id);await camp.save();await TRPG.updateMany({userId:u.id,activeCampaignId:camp._id},{$set:{activeCampaignId:null}});return i.reply(`🚪 <@${u.id}> 已離開隊伍。`);}return i.reply({embeds:[new EmbedBuilder().setTitle(`👥 ${camp.name} 隊伍`).setDescription(camp.party.map((m,n)=>`${n+1}. <@${m.userId}> · ${m.role==='gm'?'🎭 GM':'🎲 玩家'}`).join('\n')||'空隊伍')]});}
async function mapCmd(i,s){const name=i.options.getString('campaign'),camp=await Campaign.findOne({guildId:i.guildId,name});if(!camp)throw new Error('找不到 Campaign。');if(s==='view'){return i.reply({embeds:[new EmbedBuilder().setColor('#16A34A').setTitle(`🗺️ ${camp.name} 地圖`).setDescription(camp.map.map(r=>r.join('')).join('\n')).addFields({name:'📍 目前位置',value:camp.location})]});}const dir=i.options.getString('direction');const labels={north:'北',south:'南',west:'西',east:'東'};camp.location=`探索區域（向${labels[dir]}移動）`;camp.storyLog.push(`隊伍向${labels[dir]}移動。`);await camp.save();return i.reply(`🧭 隊伍向 **${labels[dir]}** 移動，現在位於 **${camp.location}**。`);}
async function monster(i,s){await seedMonsters();if(s==='list'){const ms=await Monster.find({}).sort({level:1});return i.reply({embeds:[new EmbedBuilder().setTitle('👾 怪物資料庫').setDescription(ms.map(m=>`${m.emoji} **${m.name}** · Lv.${m.level} · ❤️ ${m.hp} · 🛡️ ${m.ac} · ⭐ ${m.xp} XP\n代號：${m.key}`).join('\n\n').slice(0,4096))]});}const m=await Monster.findOne({key:i.options.getString('key')});if(!m)throw new Error('找不到怪物代號。');return i.reply({embeds:[new EmbedBuilder().setTitle(`${m.emoji} ${m.name}`).setDescription(m.description).addFields({name:'戰鬥',value:`Lv.${m.level} · ❤️ ${m.hp} · 🛡️ ${m.ac} · ⚔️ +${m.attack} · ${m.damage}`},{name:'獎勵',value:`⭐ ${m.xp} XP · 💰 ${m.gold} 金幣`},{name:'技能',value:m.skills.join('、')||'無'},{name:'掉落',value:m.loot.join('、')||'無'})]});}
async function skill(i,s){if(s==='list')return i.reply({embeds:[new EmbedBuilder().setTitle('⚔️ 技能列表').setDescription(Object.entries(SKILLS).map(([k,x])=>`**${k}** · ${x.emoji} ${x.name} · ${x.cost} MP · ${x.damage}\n${x.desc}`).join('\n\n'))]});const c=await findChar(i),key=i.options.getString('skill'),sk=SKILLS[key];if(!sk)throw new Error('找不到技能代號。');if(!c.skills.includes(key))throw new Error('你的角色沒有學會這個技能。');if(c.mp<sk.cost)throw new Error('MP 不足。');c.mp-=sk.cost;await c.save();return i.reply(`✨ 已使用 **${sk.name}**，消耗 ${sk.cost} MP。戰鬥請使用 /trpg battle 的技能按鈕。`);}
async function spell(i,s){if(s==='list')return i.reply({embeds:[new EmbedBuilder().setTitle('🧙 法術列表').setDescription(Object.entries(SPELLS).map(([k,x])=>`**${k}** · ${x.emoji} ${x.name} · ${x.cost} MP · ${x.damage}\n${x.desc}`).join('\n\n'))]});const c=await findChar(i),key=i.options.getString('spell'),sp=SPELLS[key];if(!sp)throw new Error('找不到法術代號。');if(!c.spells.includes(key))throw new Error('你的角色沒有學會這個法術。');if(c.mp<sp.cost)throw new Error('MP 不足。');c.mp-=sp.cost;if(key==='heal'){const n=roll(sp.damage).total+c.getModifier(sp.stat);c.hp=Math.min(c.maxHp,c.hp+n);await c.save();return i.reply(`💚 **${sp.name}** 恢復 ${n} HP。`);}await c.save();return i.reply(`✨ **${sp.name}** 已施放，消耗 ${sp.cost} MP；戰鬥中請使用技能系統。`);}
async function equipment(i,s){const c=await findChar(i);if(s==='list'){return i.reply({embeds:[new EmbedBuilder().setTitle(`🎒 ${c.name} 裝備欄`).setDescription(`⚔️ 武器：${c.equipment.weapon||'無'}\n🛡️ 護甲：${c.equipment.armor||'無'}\n💍 飾品：${c.equipment.accessory||'無'}`)]});}if(s==='unequip'){const slot=i.options.getString('slot');c.equipment[slot]='';await c.save();return i.reply(`📤 已卸下 ${slot} 裝備。`);}const name=i.options.getString('item'),it=c.inventory.find(x=>x.name===name);if(!it)throw new Error('背包沒有這件物品。');if(!it.slot)throw new Error('這不是可裝備物品。');c.equipment[it.slot]=it.name;if(it.slot==='armor')c.ac=10+Math.max(0,c.getModifier('dex'))+it.power;if(it.slot==='weapon')c.class.damage='1d8+'+it.power;await c.save();return i.reply(`🛡️ 已裝備 **${it.name}**。`);}
async function shop(i,s){const c=await findChar(i);if(s==='list')return i.reply({embeds:[new EmbedBuilder().setTitle('💰 冒險者商店').setDescription(Object.entries(SHOP).map(([k,x])=>`**${k}** · ${x.name} · 💰 ${x.price}\n${x.description}`).join('\n\n'))]});if(s==='buy'){const key=i.options.getString('item'),it=SHOP[key];if(!it)throw new Error('找不到商品代號。');const q=i.options.getInteger('quantity')||1,total=it.price*q;if(c.gold<total)throw new Error('金幣不足。');const old=item(c,it.name);if(old){old.quantity+=q;}else c.inventory.push({name:it.name,type:it.type,quantity:q,effect:it.effect||0,description:it.description,slot:it.slot||'',power:it.power||0});c.gold-=total;await c.save();return i.reply(`🛒 購買 **${it.name} ×${q}**，花費 ${total} 金幣。`);}const name=i.options.getString('item'),q=i.options.getInteger('quantity')||1,it=item(c,name);if(!it||it.quantity<q)throw new Error('背包中的物品數量不足。');it.quantity-=q;c.gold+=(SHOP[Object.keys(SHOP).find(k=>SHOP[k].name===name)]?.price||10)*q*0.5;c.inventory=c.inventory.filter(x=>x.quantity>0);await c.save();return i.reply(`💰 出售 **${name} ×${q}**。`);}
async function quest(i,s){const name=i.options.getString('campaign'),camp=await Campaign.findOne({guildId:i.guildId,name});if(!camp)throw new Error('找不到 Campaign。');const m=getMember(camp,i.user.id);if(!m)throw new Error('你不是隊員。');if(s==='list')return i.reply({embeds:[new EmbedBuilder().setTitle(`📜 ${camp.name} 任務`).setDescription(camp.quests.map(q=>`**${q.id}** · ${q.title} · ${q.status}\n${q.description} · ⭐${q.rewardXp} · 💰${q.rewardGold}`).join('\n\n'))]});const c=await TRPG.findById(m.characterId);if(!c)throw new Error('角色不存在。');if(s==='accept'){const q=camp.quests.find(x=>x.id===i.options.getString('id'));if(!q)throw new Error('找不到任務。');if(q.status!=='available')throw new Error('任務目前不可接受。');q.status='active';camp.currentQuestId=q.id;await camp.save();return i.reply(`📜 已接受 **${q.title}**！`);}const q=camp.quests.find(x=>x.id===camp.currentQuestId);if(!q||q.status!=='active')throw new Error('目前沒有進行中的任務。');q.status='completed';c.questsCompleted++;c.exp+=q.rewardXp;c.gold+=q.rewardGold;await awardAchievements(c);await Promise.all([camp.save(),c.save()]);return i.reply(`🏆 任務完成！**${q.title}**\n⭐ +${q.rewardXp} XP · 💰 +${q.rewardGold} 金幣`);}
async function achievement(i){const c=await findChar(i,i.options.getString('name'));const done=new Set(c.achievements);return i.reply({embeds:[new EmbedBuilder().setTitle(`🏆 ${c.name} 的成就`).setDescription(ACHIEVEMENTS.map(a=>`${done.has(a[0])?'🏆':'🔒'} **${a[1]}** — ${a[2]}\n獎勵：⭐${a[3]} XP · 💰${a[4]}`).join('\n\n'))]});}
