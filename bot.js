//imports
const Discord = require('discord.js')
const got = require('got')
const cron = require('node-cron')
const cheerio = require('cheerio')
const puppeteer = require('puppeteer')
const puppeteerExtra = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const fs = require('fs')
const { google } = require('googleapis')

//config 
const auth = require('./auth.json')

const authentication = async () => {
    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets"
    })

    const client = await auth.getClient()

    const sheets = google.sheets({
        version: 'v4',
        auth: client
    })
    return { sheets }
}

//spreadsheet id ref
const id = '1_KE_EGB_3SVReGXUs5COBv3qLHY9fikDYO_7Xd6jEVY'

//constant globals
const gmedd_report_model_url = "https://gmedd.com/report-model/";

//global variables
var today = "";
var todays_num_jobs = 0;
var todays_jobs = [];
var pageNum = 1

// Initialize Discord Bot
var client = new Discord.Client();
var token = auth.token;

client.on('ready', async function (evt) {
    console.log(`Logged in as ${client.user.tag}`);
    const logoattachment = new Discord.MessageAttachment('./logo.png', 'logo.png');

    var gme_channel = client.channels.cache.find(channel => channel.name.toLowerCase() === '🔬gme-tracker');
    //cron job to automatically spin up job listing search daily in the evenings 
    cron.schedule('00 22 * * 0-6', async function() {
         //console.log(gme_channel);
         //console.log('Running !jobs at 22:00 (10PM) CST every day');
         await get_the_jobs();
         display_todays_jobs(gme_channel, logoattachment);
    }, {
        scheduled: true,
        timezone: "America/Chicago"
    });
});

client.on('message', async msg => {
    const logoattachment = new Discord.MessageAttachment('./logo.png', 'logo.png');

    //ryan easter egg
    if (msg.content.toLowerCase().includes('chairman')) {
        msg.react('🪑');
    }
    //ryan easter egg
    if (msg.content.toLowerCase().includes('brick by brick')) {
        msg.react('🧱');
    }
    //rod easter egg
    if (msg.content.toLowerCase().includes('order numbers')) {
        msg.react('<:rod:820207421460578335>');
    }
    
    if (msg.content.substring(0, 1) == '/') {
        var args = msg.content.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {
            //return current date's job postings
            case 'jobs':
                //fetch the data
                await get_the_jobs();
                display_todays_jobs(msg.channel, logoattachment);
                break;
            case 'hires':
                var hires = await get_the_hires();
                display_the_hires(msg, hires, logoattachment);
                break;
            case 'media':
                var media = await get_the_media();
                display_the_media(msg, media, logoattachment);
                break;
            case 'model':
                var model = await get_the_model();
                display_the_model(msg, model, logoattachment);
                break;
            case 'report': 
                var report = await get_the_report();
                display_the_report(msg, report, logoattachment);
                break;
            case 'orders':
                var order_form = await get_the_order_form();
                display_the_order_form(msg, order_form, logoattachment);
                break;
            case 'latest': 
                var gmedd = await get_the_latest_gmedd();
                msg.channel.send(gmedd.link)
                break;
            case 'skus': 
                var totalskus = await get_the_skus();
                display_the_skus(msg, totalskus, logoattachment);
                break;
            case 'commands':
                display_the_help(msg, logoattachment);
                break;
         }
     }
});

client.login(token);

function display_todays_jobs(channel, logoattachment) {
    //list each individual job posting in the embed
    if (todays_jobs.length > 0) {
        //build embed properties
        let embed = new Discord.MessageEmbed()
        .attachFiles(logoattachment)
        .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
        .setColor('#242424')
        .setThumbnail('attachment://logo.png')
        .setTimestamp()
        .setFooter('Based on public data available on gamestop.com', client.user.avatarURL());
        if (todays_num_jobs > 15) {
            embed.setDescription(`We found **${todays_num_jobs}** jobs for ${today}`)
        }
        else {
            embed.setDescription(`We found **${todays_num_jobs}** jobs for ${today}.`)
        }
        var stopAt = (todays_jobs.length > 15) ? 15 : todays_jobs.length;
        for (var i = 0; i < stopAt; i++) {
            var job = todays_jobs[i];
            embed.addFields(
                { name: `⠀`, value: `[**${job.title}**](${job.link})\n **`+job.category+`**\n`+job.location}    
            );  
        }    
        //send embedded response
        channel.send(embed)
            .catch(console.error);
    }
}

function display_the_skus(msg, skus, logoattachment) {
    //build embed properties
    let skus_embed = new Discord.MessageEmbed()
    .setDescription(`[**${skus}**]('https://www.gamestop.com/search/?prefn1=buryMaster&prefv1=In%20Stock&q=%3Fall&view=new&tileView=list')`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    msg.channel.send(skus_embed);
}

function display_the_model(msg, model, logoattachment) {
    //build embed properties
    let model_embed = new Discord.MessageEmbed()
    .setDescription(`[**GMEdd Financial Model**](${model})`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    msg.channel.send(model_embed);
}

function display_the_hires(msg, hires, logoattachment) {
    //build embed properties
    let hires_embed = new Discord.MessageEmbed()
    .setDescription(`[**GameStop Tech and Ecommerce Hires**](${hires})`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    msg.channel.send(hires_embed);
}

function display_the_media(msg, media, logoattachment) {
    //build embed properties
    let media_embed = new Discord.MessageEmbed()
    .setDescription(`[**Ryan Cohen Media**](${media})`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    msg.channel.send(media_embed);
}

function display_the_report(msg, report, logoattachment) {
    //build embed properties
    let report_embed = new Discord.MessageEmbed()
    .setDescription(`[**GMEdd Research Report**](${report})`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    msg.channel.send(report_embed);
}

function display_the_order_form(msg, order_form, logoattachment) {
    //build embed properties
    let order_form_embed = new Discord.MessageEmbed()
    .setDescription(`[**GameStop Order Form**](${order_form})`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    msg.channel.send(order_form_embed);
}

function display_the_help(msg, logoattachment) {
    let embed = new Discord.MessageEmbed()
    .setTitle('GameStop Tracker Available Commands')
    .attachFiles(logoattachment)
    .setAuthor('GMEdd.com', null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .addFields(
        {name: `**/hires**`, value: `Returns link to the LinkedIn hires spreadsheet from [GMEdd](GMEdd.com)`},
        {name: `**/media**`, value: `Returns link to the Ryan Cohen Media spreadsheet from [GMEdd](GMEdd.com)`},
        {name: `**/model**`, value: `Returns link to the current [GMEdd](GMEdd.com) GameStop financial model`},
        {name: `**/report**`, value: `Returns link to the current [GMEdd](GMEdd.com) GameStop Research Report`},
        {name: `**/orders**`, value: `Returns link to the GMEdd GameStop Order Form`}
    );
    msg.channel.send(embed);
}

//direct link to linkedin hires spreadsheet from gmedd.com
async function get_the_hires() {
    return "https://gmedd.com/hires";
}

//direct link to rc media spreadsheet from gmedd.com
async function get_the_media() {
   return "https://gmedd.com/rcmedia";
}

//direct link to the gmedd.com order submission form
async function get_the_order_form() {
    return "https://docs.google.com/forms/d/e/1FAIpQLSc3oguMk4tWZRlX5bv5_72y-_AqfP2meYu8nuFGUq2iXiB5XQ/viewform";
 }

//direct link to gmedd model from gmedd.com
async function get_the_model() {
    var link = "";

    await got(gmedd_report_model_url).then(response => {
        const $ = cheerio.load(response.body);
        const model_element = $('#model');
        link = model_element.attr('href');
    }).catch(err => {
        console.log(err);
    });

    return link;
}

//direct link to gmedd research report from gmedd.com
async function get_the_report() {
    var link = "";

    await got(gmedd_report_model_url).then(response => {
        const $ = cheerio.load(response.body);
        const report_element = $('#report');
        link = report_element.attr('href');
    }).catch(err => {
        console.log(err);
    });

    return link;
}

async function get_the_skus() {
    //launch
    puppeteerExtra.use(pluginStealth())
    const browser = await puppeteerExtra.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36']})
    const context = await browser.createIncognitoBrowserContext()
    const page = await context.newPage()
    //if any unhandled promise rejections are encountered, exit the browser
    process.on('unhandledRejection', async (reason, p) => {
        console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
        await browser.close();
    });
    await page.setViewport({ width: 1280, height: 720 });
    const url = 'https://www.gamestop.com/search/?prefn1=buryMaster&prefv1=In%20Stock&q=%3Fall&view=new&tileView=list'
    await page.goto(url)
    await page.waitForTimeout(5000)
    var instockSkus = ""
    try {
        await page.screenshot({path: 'try-block-screenshot.png', fullPage: true})
        instockSkus = await page.evaluate(() => {
            var element = document.querySelector('span.pageResults.product-search-count').innerText.trim()
            return element
        })
    } catch (e) {
        console.log(e)
        await page.screenshot({path: 'catch-block-screenshot.png', fullPage: true})

    }
    await browser.close()
    return instockSkus
}

async function get_the_latest_gmedd() {
    //launch
    const browser = await puppeteerExtra.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']})
    const page = await browser.newPage()
    //if any unhandled promise rejections are encountered, exit the browser
    process.on('unhandledRejection', async (reason, p) => {
        console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
        await browser.close();
    });
    //request website 
    const url = 'https://gmedd.com'
    await page.goto(url, {waitUntil: 'networkidle2'})
    let articletitle = await page.evaluate(() => document.querySelectorAll('.entry-title a')[1].innerText)
    let articlelink = await page.evaluate(() => document.querySelectorAll('.entry-title a')[1].href)
    let articleimg = await page.evaluate(() => document.querySelectorAll('.entry-content div div div div p img')[1].src)
    await browser.close()
    return {title: articletitle, link: articlelink, img: articleimg}
}

async function get_the_jobs() {
    //launch
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']})
    const page = await browser.newPage()
    //if any unhandled promise rejections are encountered, exit the browser
    process.on('unhandledRejection', async (reason, p) => {
        console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
        await browser.close();
    });
    if (pageNum > 10) {
        //no need to travel further than this
        await browser.close()
        return
    }
    //request careers webpage
    const url = 'https://careers.gamestop.com/us/en/search-results?keywords='
    const careersPage = url.concat('&from=', parseInt((pageNum * 10) - 10))
    //console.log(careersPage)
    await page.goto(careersPage)
    //filter by most recent and make sure it loads
    await page.waitForSelector('#sortselect')
    await page.select('select#sortselect', 'Most recent')
    //screenshot
    await page.screenshot({path: 'current-listings-page'+parseInt(pageNum)+'.png', fullPage: true})    
    const jobs = await page.evaluate(() => {
        temp = []
        const dates = Array.from(document.querySelectorAll('[data-ph-at-job-post-date-text]')).map(x => x.getAttribute('data-ph-at-job-post-date-text'))
        const links = Array.from(document.querySelectorAll('.information span a')).map(x => x.href)
        const titles = Array.from(document.querySelectorAll('.job-title span')).map(x => x.textContent)
        const categories = Array.from(document.querySelectorAll('span.job-category')).map(x => x.textContent)
        const locations = Array.from(document.querySelectorAll('span.job-location')).map(x => x.textContent)
        for (i = 0; i < titles.length; i++) {
            const jobdate = dates[i].split('T')[0]
            const parsedate = jobdate.split('-')
            const readable_date = {year: parsedate[0], month: parsedate[1].replace(/^[0\.]+/, ""), day: parsedate[2].replace(/^[0\.]+/, "")}
            const joblink = links[i]
            const jobtitle = titles[i].trim()
            const jobcategory = categories[i].replace("Category", "").replace(/[\r\n\t]/g, "").trim()
            const joblocation = locations[i].replace("Location", "").replace(/[\r\n\t]/g, "").trim().split("United States of America")[0].trim()
            temp.push({date: jobdate, title: jobtitle, link: joblink, category: jobcategory, location: joblocation, readable_date: readable_date})
        }
        return temp
    })
    //log job objects to console
    console.log("Jobs from page " + parseInt(pageNum))
    jobs.forEach(j => console.log(j))
    //capture jobs in text file
    //fs.writeFile('jobs.txt', JSON.stringify(jobs, null, 2), {flag: "a+"})
    todays_date = get_todays_date()
    todays_jobs = jobs.filter(j => was_posted_today(j, todays_date))
    console.log(`Today's jobs on page ${pageNum}`,todays_jobs)
    todays_num_jobs = todays_jobs.length
    //determine if we need to go to the next page
    // if (todays_num_jobs == 10) {
    //     pageNum++
    //     start(pageNum)
    // }
    //close browser
    await browser.close()
}

//returns current date in CST (Chicago) time
function get_todays_date() {    
    today = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}).split(',')[0];
    console.log("today", today);
    var today_split = today.split("/");
    var today_year = today_split[2].replace(/,/g, "");
    var today_month = today_split[0].replace(/,/g, "");
    var today_day = today_split[1].replace(/,/g, "");

    return {'year': today_year, 'month': today_month, 'day': today_day};
}

//check if the job listing from web scrape is from today's date
function was_posted_today(entry, todays_date) {
    return (entry.readable_date.day == todays_date.day && entry.readable_date.month == todays_date.month && entry.readable_date.year == todays_date.year); 
}