const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const TRPG = require('../../../models/TRPG');

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
const ENEMIES = [
    ['哥布林','👺',18,11,3,'1d6+1',35,20],
    ['骷髏兵','💀',24,12,4,'1d6+2',45,28],
    ['狼群首領','🐺',30,13,5,'1d8+2',60,40],
    ['獸人戰士','👹',38,14,6,'1d10+2',80,55],
    ['暗影法師','🧙',34,15,7,'1d8+3',90,70],
    ['幼龍','🐲',55,16,8,'2d8+2',150,120]
];

const d = n => Math.floor(Math.random() * n) + 1;
const mod = n => Math.floor((n - 10) / 2);
const signed = n => n >= 0 ? `+${n}` : `${n}`;

function roll(expr) {
    const m = String(expr).trim().toLowerCase().match(/^(\d{1,2})d(\d{1,4})([+-]\d{1,4})?$/);
    if (!m) throw new Error('骰子格式必須是 1d20、2d6+3 等。');
    const count = +m[1], sides = +m[2], bonus = +(m[3] || 0);
    if (count < 1 || count > 20 || sides < 2 || sides > 1000) throw new Error('骰子最多 20 顆、每顆最多 1000 面。');
    const rolls = Array.from({length:count}, () => d(sides));
    return { rolls, total: rolls.reduce((a,b)=>a+b,0)+bonus, bonus };
}
function statRoll() {
    const a = Array.from({length:4},()=>d(6)).sort((a,b)=>a-b);
    return {dice:a, total:a[1]+a[2]+a[3]};
}
function item(c, name) { return c.inventory.find(x => x.name === name); }
function xpBar(c) {
    const max=c.getXpToNextLevel(), n=Math.round(Math.min(c.exp,max)/max*10);
    return '█'.repeat(n)+'░'.repeat(10-n);
}
function charEmbed(c,u,title) {
    const attrs=Object.entries(STATS).map(([k,v])=>`**${v} (${k.toUpperCase()})** ${c.attributes[k]} (${signed(mod(c.attributes[k]))})`).join('\n');
    return new EmbedBuilder().setColor('#A855F7').setTitle(title||`${c.class.emoji} ${c.name}`)
        .setDescription(`${c.race.emoji} **${c.race.name}** · ${c.class.emoji} **${c.class.name}** · Lv.${c.level}\nXP **${c.exp}/100**\n${xpBar(c)}`)
        .addFields(
            {name:'❤️ 生命',value:`**${c.hp}/${c.maxHp} HP**\n🛡️ AC **${c.ac}**`,inline:true},
            {name:'💰 財富',value:`**${c.gold || 0}** 金幣`,inline:true},
            {name:'⚔️ 戰鬥',value:`${c.class.weapon || '徒手'} · ${c.class.damage || '1d6'}\n${c.class.skill || '無'}`,inline:true},
            {name:'📊 屬性',value:attrs},
            {name:'🏆 戰績',value:`勝場 ${c.victories||0} · 敗場 ${c.defeats||0}`}
        ).setThumbnail(u.displayAvatarURL({size:256})).setFooter({text:`角色擁有者：${u.username}`}).setTimestamp();
}
async function findChar(i,name,userId=i.user.id) {
    const q={userId}; const cs=await TRPG.find(name?{...q,name}:q).sort({createdAt:1});
    if(!cs.length) throw new Error('找不到角色。請先使用 /trpg character create。');
    if(name){const c=cs.find(x=>x.name.toLowerCase()===name.toLowerCase()); if(!c) throw new Error(`找不到角色「${name}」。`); return c;}
    return cs[0];
}

module.exports = {
    category:'TRPG',
    data:new SlashCommandBuilder().setName('trpg').setDescription('🎲 完整 TRPG 冒險系統').setDMPermission(false)
    .addSubcommandGroup(g=>g.setName('character').setDescription('🎭 角色卡管理')
        .addSubcommand(s=>s.setName('create').setDescription('建立角色').addStringOption(o=>o.setName('name').setDescription('角色名稱'))
            .addStringOption(o=>o.setName('race').setDescription('種族').addChoices(...Object.entries(RACES).map(([v,x])=>({name:`${x[1]} ${x[0]}`,value:v}))))
            .addStringOption(o=>o.setName('class').setDescription('職業').addChoices(...Object.entries(CLASSES).map(([v,x])=>({name:`${x[1]} ${x[0]}`,value:v})))))
        .addSubcommand(s=>s.setName('list').setDescription('查看你的所有角色'))
        .addSubcommand(s=>s.setName('view').setDescription('查看角色').addStringOption(o=>o.setName('name').setDescription('角色名稱')).addUserOption(o=>o.setName('user').setDescription('查看其他玩家的角色')))
        .addSubcommand(s=>s.setName('delete').setDescription('永久刪除角色').addStringOption(o=>o.setName('name').setDescription('角色名稱').setRequired(true)))
    )
    .addSubcommand(s=>s.setName('roll').setDescription('🎲 擲骰子').addStringOption(o=>o.setName('dice').setDescription('例如 1d20、2d6+3').setRequired(true)))
    .addSubcommand(s=>s.setName('check').setDescription('🎯 D20 屬性檢定').addStringOption(o=>o.setName('stat').setDescription('屬性').setRequired(true).addChoices(...Object.entries(STATS).map(([v,n])=>({name:`${n} (${v.toUpperCase()})`,value:v})))).addIntegerOption(o=>o.setName('dc').setDescription('難度 DC，預設 10').setMinValue(1).setMaxValue(40)).addStringOption(o=>o.setName('name').setDescription('角色名稱')))
    .addSubcommand(s=>s.setName('battle').setDescription('⚔️ 隨機遭遇戰').addStringOption(o=>o.setName('name').setDescription('角色名稱')))
    .addSubcommand(s=>s.setName('heal').setDescription('🧪 使用治療藥水').addStringOption(o=>o.setName('name').setDescription('角色名稱')))
    .addSubcommand(s=>s.setName('rest').setDescription('🛏️ 完全休息').addStringOption(o=>o.setName('name').setDescription('角色名稱')))
    .addSubcommand(s=>s.setName('inventory').setDescription('🎒 查看背包').addStringOption(o=>o.setName('name').setDescription('角色名稱'))),

    async execute(i) {
        try {
            if(!i.guildId) return i.reply({content:'❌ TRPG 只能在伺服器使用。',ephemeral:true});
            const group=i.options.getSubcommandGroup(false), sub=i.options.getSubcommand();
            if(group==='character') return character(i,sub);
            if(sub==='roll') return dice(i);
            if(sub==='check') return check(i);
            if(sub==='heal') return heal(i);
            if(sub==='rest') return rest(i);
            if(sub==='inventory') return inventory(i);
            if(sub==='battle') return battle(i);
        } catch(e) {
            console.error('TRPG error:',e);
            const fn=i.replied||i.deferred?'followUp':'reply';
            return i[fn]({content:`❌ ${e.message}`,ephemeral:true}).catch(()=>null);
        }
    }
};

async function character(i,sub) {
    if(sub==='create') {
        const name=(i.options.getString('name')||`冒險者・${i.user.username}`).trim();
        const raceKey=i.options.getString('race')||Object.keys(RACES)[Math.floor(Math.random()*Object.keys(RACES).length)];
        const classKey=i.options.getString('class')||Object.keys(CLASSES)[Math.floor(Math.random()*Object.keys(CLASSES).length)];
        const r=RACES[raceKey], c=CLASSES[classKey];
        if(name.length>24) throw new Error('角色名稱最多 24 個字。');
        if(await TRPG.exists({userId:i.user.id,name})) throw new Error('你已有同名角色。');
        const attrs={}, details=[];
        for(const k of Object.keys(STATS)){const x=statRoll();attrs[k]=Math.min(20,x.total+r[2][k]);details.push(`${STATS[k]} ${attrs[k]} [${x.dice.join(',')}]`);}
        const hp=c[6]+r[3]+Math.max(0,mod(attrs.con)*2);
        const char=new TRPG({userId:i.user.id,guildId:i.guildId,name,race:{name:r[0],emoji:r[1]},class:{name:c[0],emoji:c[1],weapon:c[2],skill:c[3],proficiency:c[4],damage:c[5]},attributes:attrs,hp,maxHp:hp,ac:10+Math.max(0,mod(attrs.dex)),gold:100,inventory:[{name:'治療藥水',type:'consumable',quantity:3,effect:10,description:'恢復 10 HP'}]});
        await char.save(); const e=charEmbed(char,i.user,'✨ 角色建立成功'); e.addFields({name:'🎲 初始屬性',value:details.join('\n').slice(0,1024)}); return i.reply({embeds:[e]});
    }
    if(sub==='list'){
        const cs=await TRPG.find({userId:i.user.id}).sort({createdAt:1}); if(!cs.length)return i.reply({content:'📭 你目前沒有角色卡。',ephemeral:true});
        return i.reply({embeds:[new EmbedBuilder().setColor('#8B5CF6').setTitle('🎭 我的角色').setDescription(cs.map((c,n)=>`${n+1}. ${c.class.emoji} **${c.name}** · Lv.${c.level} · ❤️ ${c.hp}/${c.maxHp} · 🏆 ${c.victories||0}`).join('\n'))]});
    }
    if(sub==='view'){
        const u=i.options.getUser('user')||i.user,c=await findChar(i,i.options.getString('name'),u.id); return i.reply({embeds:[charEmbed(c,u)]});
    }
    if(sub==='delete'){
        const c=await findChar(i,i.options.getString('name')); await i.reply({content:`⚠️ 確定永久刪除 **${c.name}**？`,ephemeral:true,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`trpg_del_yes:${c.id}`).setLabel('確認刪除').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId('trpg_del_no').setLabel('取消').setStyle(ButtonStyle.Secondary))]});
        const m=await i.fetchReply(),col=m.createMessageComponentCollector({time:30000});
        col.on('collect',async b=>{if(b.user.id!==i.user.id)return b.reply({content:'❌ 只有發起者可以操作。',ephemeral:true});if(b.customId==='trpg_del_no'){col.stop();return b.update({content:'❎ 已取消。',components:[]});}if(b.customId===`trpg_del_yes:${c.id}`){await TRPG.deleteOne({_id:c.id,userId:i.user.id});col.stop();return b.update({content:`🪦 **${c.name}** 已刪除。`,components:[]});}});
        col.on('end',(_,reason)=>{if(reason==='time')i.editReply({content:'⌛ 操作逾時。',components:[]}).catch(()=>{});});
    }
}
async function dice(i){const x=roll(i.options.getString('dice'));return i.reply({embeds:[new EmbedBuilder().setColor('#F59E0B').setTitle('🎲 骰子結果').setDescription(`${i.options.getString('dice')} → [${x.rolls.join(', ')}] ${x.bonus?signed(x.bonus):''} = **${x.total}**`).setFooter({text:`擲骰者：${i.user.username}`})]});}
async function check(i){const c=await findChar(i,i.options.getString('name')),stat=i.options.getString('stat'),dc=i.options.getInteger('dc')||10,r=d(20),m=c.getModifier(stat),total=r+m,success=r===20||(r!==1&&total>=dc);return i.reply({embeds:[new EmbedBuilder().setColor(r===20?'#F1C40F':success?'#22C55E':'#EF4444').setTitle(r===20?'🌟 大成功！':r===1?'💥 大失敗！':success?'✅ 檢定成功':'❌ 檢定失敗').setDescription(`**${c.name}** 的 ${STATS[stat]} 檢定\n\n🎲 d20 **${r}** ${signed(m)} = **${total}**\n🎯 DC **${dc}**`)]});}
async function heal(i){const c=await findChar(i,i.options.getString('name'));if(c.hp>=c.maxHp)return i.reply({content:'❤️ HP 已滿。',ephemeral:true});const p=item(c,'治療藥水');if(!p||p.quantity<1)return i.reply({content:'🧪 沒有治療藥水了。',ephemeral:true});const n=Math.min(p.effect||10,c.maxHp-c.hp);c.hp+=n;p.quantity--;c.inventory=c.inventory.filter(x=>x.quantity>0);await c.save();return i.reply({content:`🧪 **${c.name}** 恢復 **${n} HP**！目前 **${c.hp}/${c.maxHp}**。`});}
async function rest(i){const c=await findChar(i,i.options.getString('name'));const old=c.hp;c.hp=c.maxHp;c.lastRestAt=new Date();await c.save();return i.reply({content:`🛏️ **${c.name}** 休息完成，恢復 **${c.hp-old} HP**。`});}
async function inventory(i){const c=await findChar(i,i.options.getString('name'));const text=c.inventory.length?c.inventory.map(x=>`**${x.name}** ×${x.quantity} — ${x.description||x.type}`).join('\n'):'背包是空的。';return i.reply({embeds:[new EmbedBuilder().setColor('#14B8A6').setTitle(`🎒 ${c.name} 的背包`).setDescription(text.slice(0,4096)).addFields({name:'💰 金幣',value:String(c.gold||0),inline:true})]});}
async function battle(i){
    const c=await findChar(i,i.options.getString('name'));if(c.hp<=0)return i.reply({content:'💀 角色倒下了，請先 /trpg rest。',ephemeral:true});
    const e=ENEMIES[Math.floor(Math.random()*ENEMIES.length)],enemy={name:e[0],emoji:e[1],hp:e[2],maxHp:e[2],ac:e[3],attack:e[4],damage:e[5],xp:e[6]};
    const view=()=>new EmbedBuilder().setColor('#EF4444').setTitle(`⚔️ ${enemy.emoji} ${enemy.name}`).setDescription(`**${c.name}** Lv.${c.level}\n❤️ 你：**${c.hp}/${c.maxHp}**\n\n${enemy.emoji} **${enemy.name}**\n❤️ 敵人：**${enemy.hp}/${enemy.maxHp}** · 🛡️ AC ${enemy.ac}`).addFields({name:'⚔️ 你的武器',value:`${c.class.weapon} · ${c.class.damage}`,inline:true},{name:'🎯 敵人攻擊',value:`+${enemy.attack} · ${enemy.damage}`,inline:true});
    const buttons=()=>[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trpg_b_atk').setLabel('⚔️ 攻擊').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId('trpg_b_pot').setLabel('🧪 藥水').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('trpg_b_run').setLabel('🏃 逃跑').setStyle(ButtonStyle.Secondary))];
    await i.reply({embeds:[view()],components:buttons()});const msg=await i.fetchReply(),col=msg.createMessageComponentCollector({time:180000});
    col.on('collect',async b=>{if(b.user.id!==i.user.id)return b.reply({content:'❌ 這場戰鬥不是你的。',ephemeral:true});try{
        let last='';
        if(b.customId==='trpg_b_run'){col.stop('flee');return b.update({embeds:[new EmbedBuilder().setColor('#64748B').setTitle('🏃 逃跑成功').setDescription(`**${c.name}** 離開了戰場。`)],components:[]});}
        if(b.customId==='trpg_b_pot'){const p=item(c,'治療藥水');if(!p||p.quantity<1)return b.reply({content:'🧪 沒有藥水。',ephemeral:true});if(c.hp>=c.maxHp)return b.reply({content:'❤️ HP 已滿。',ephemeral:true});const heal=Math.min(p.effect||10,c.maxHp-c.hp);c.hp+=heal;p.quantity--;c.inventory=c.inventory.filter(x=>x.quantity>0);last=`🧪 恢復 **${heal} HP**。`;}
        else if(b.customId==='trpg_b_atk'){const stat=c.class.proficiency.toLowerCase(),ar=d(20),am=c.getModifier(stat),total=ar+am,crit=ar===20;if(ar!==1&&(crit||total>=enemy.ac)){let dmg=Math.max(1,roll(c.class.damage||'1d6').total+am);if(crit)dmg*=2;enemy.hp=Math.max(0,enemy.hp-dmg);last=`🎯 ${crit?'暴擊！ ':''}命中，造成 **${dmg} 傷害**。`;}else last=ar===1?'💥 大失敗！':'❌ 未命中。';
            if(enemy.hp<=0){const old=c.level,reward=enemy.xp;c.exp=(c.exp||0)+reward;c.victories=(c.victories||0)+1;if(c.exp>=100*old){c.exp-=100*old;c.level=old+1;c.maxHp+=5;c.hp=c.maxHp;last+=`\n🎉 升級！ Lv.${old} → Lv.${c.level}`;}await c.save();col.stop('win');return b.update({embeds:[new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 戰鬥勝利！').setDescription(`**${c.name}** 擊敗 **${enemy.emoji} ${enemy.name}**！\n\n${last}\n⭐ +${reward} XP`)],components:[]});}}
        const er=d(20);let enemyText='敵人未命中。';if(er!==1&&er+enemy.attack>=c.ac){const dmg=roll(enemy.damage).total;c.hp=Math.max(0,c.hp-dmg);enemyText=`${enemy.emoji} 反擊造成 **${dmg} 傷害**。`;}
        if(c.hp<=0){c.defeats=(c.defeats||0)+1;await c.save();col.stop('dead');return b.update({embeds:[new EmbedBuilder().setColor('#111827').setTitle('💀 角色倒下').setDescription(`${last}\n${enemyText}\n\n**${c.name}** 被擊倒了，請使用 /trpg rest。`)],components:[]});}
        await c.save();const next=view();next.setDescription(next.data.description+`\n\n${last}\n${enemyText}`);return b.update({embeds:[next],components:buttons()});
    }catch(e){return b.reply({content:`❌ ${e.message}`,ephemeral:true}).catch(()=>null);}});
    col.on('end',(_,reason)=>{if(!['win','dead','flee'].includes(reason))i.editReply({components:[]}).catch(()=>{});});
}
