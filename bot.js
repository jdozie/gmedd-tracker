//imports
const Discord = require('discord.js')
const got = require('got')
const cron = require('node-cron')
const cheerio = require('cheerio')
const puppeteer = require('puppeteer')
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

    // var gme_channel = client.channels.cache.find(channel => channel.name.toLowerCase() === '🔬gme-tracker');
    // //cron job to automatically spin up job listing search daily in the evenings 
    // cron.schedule('00 22 * * 0-6', async function() {
    //      //console.log(gme_channel);
    //      //console.log('Running !jobs at 22:00 (10PM) CST every day');
    //      await get_the_jobs();
    //      display_todays_jobs(gme_channel, logoattachment);
    // }, {
    //     scheduled: true,
    //     timezone: "America/Chicago"
    // });
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
            case 'test':
                await load_careers_site();
                display_todays_jobs(msg, logoattachment);
                break;
            case 'commands':
                display_the_help(msg, logoattachment);
                break;
         }
     }
});

client.login(token);

function display_todays_jobs(msg, logoattachment) {
    //build embed properties
    let embed = new Discord.MessageEmbed()
    .setTitle(`${today} Career Postings`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .setFooter('Based on public data available on gamestop.com', client.user.avatarURL());


    if (todays_num_jobs > 15) {
        embed.setDescription(`GameStop posted **${todays_num_jobs}** new jobs today. Here are the first 15.`)
    }
    else {
        embed.setDescription(`GameStop posted **${todays_num_jobs}** new jobs today.`)
    }

    //list each individual job posting in the embed
    if (todays_jobs.length > 0) {
        if (todays_jobs.length > 15) {
            for (var i = 0; i < 15; i++) {
                var job = todays_jobs[i];
                embed.addFields(
                    { name: `⠀`, value: `[${job.title}](${job.link})\n`+job.category+`\n`+job.location}    
                );  
            }    
        }
        else {
            for (var i = 0; i < todays_jobs.length; i++) {
                var job = todays_jobs[i];
                embed.addFields(
                    { name: `⠀`, value: `[${job.title}](${job.link})\n`+job.category+`\n`+job.location}    
                );  
            }    
        }
    
    }

    //send embedded response
    msg.channel.send(embed)
            //.then(console.log)
            .catch(console.error);        

}

function display_the_model(msg, model, logoattachment) {
    //build embed properties
    let model_embed = new Discord.MessageEmbed()
    .setTitle(`GMEdd Financial Model`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .addField('⠀', model);
    msg.channel.send(model_embed);
}

function display_the_hires(msg, hires, logoattachment) {
    //build embed properties
    let hires_embed = new Discord.MessageEmbed()
    .setTitle(`GameStop Tech and Ecommerce Hires`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .setDescription(`Direct link to database of public GameStop tech & e-commerce hires tracked by GMEdd.`)
    .addField('⠀', hires);
    msg.channel.send(hires_embed);
}

function display_the_media(msg, media, logoattachment) {
    //build embed properties
    let media_embed = new Discord.MessageEmbed()
    .setTitle(`Ryan Cohen Media`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .setDescription(`Links to various media appearances by Ryan Cohen (articles, video interviews).`)
    .addField('⠀', media);
    msg.channel.send(media_embed);
}

function display_the_report(msg, report, logoattachment) {
    //build embed properties
    let report_embed = new Discord.MessageEmbed()
    .setTitle(`GMEdd Research Report`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .addField('⠀', report);
    msg.channel.send(report_embed);
}

function display_the_order_form(msg, order_form, logoattachment) {
    //build embed properties
    let order_form_embed = new Discord.MessageEmbed()
    .setTitle(`GameStop Order Form`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .setDescription(`Direct link to GMEdd's Order Submission Form to track GameStop orders.`)
    .addField('⠀', order_form);
    msg.channel.send(order_form_embed);
}

function display_the_help(msg, logoattachment) {
    let embed = new Discord.MessageEmbed()
    .setTitle('Bot Commands')
    .attachFiles(logoattachment)
    .setAuthor('GMEdd.com', null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .addFields(
        //{name: `**!jobs**`, value: 'Returns a list of jobs that were posted today on gamestop.com, if available. Runs daily in #🔬gme-tracker.'},
        {name: `**/hires**`, value: `Returns link to the LinkedIn hires spreadsheet from [GMEdd](GMEdd.com)`},
        {name: `**/media**`, value: `Returns link to the Ryan Cohen Media spreadsheet from [GMEdd](GMEdd.com)`},
        {name: `**/model**`, value: `Returns link to the current [GMEdd](GMEdd.com) GameStop financial model`},
        {name: `**/report**`, value: `Returns link to the [GMEdd](GMEdd.com) GameStop Research Report`},
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

//TEST
async function load_careers_site() {
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
        exit()
    }
    
    //request careers webpage
    const url = 'https://careers.gamestop.com/us/en/search-results?keywords='
    const careersPage = url.concat('&from=', parseInt((pageNum * 10) - 10))
    console.log(careersPage)
    
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
            const joblocation = locations[i].replace("Location", "").replace(/[\r\n\t]/g, "").trim()
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

    //write today's listings to google sheet
    for (j in todays_jobs) {
        var json = JSON.stringify(j)
        try {
            const { newJobDate, newJobTitle, newJobURL, newJobCategory, newJobLocation } = json
            const { sheets } = await authentication()
            const writeReq = await sheets.spreadsheets.values.append({
                spreadsheetId: id, 
                range: 'Sheet1', 
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [
                        [newJobTitle, newJobURL, newJobCategory, newJobLocation, newJobDate]
                    ]
                }
            })
            if (writeReq.status === 200) {
                console.log('Spreadsheet updated successfully!')
            }
        } catch(e) {
            console.log('Error updating spreadsheet', e)
        }
    }
    console.log(todays_jobs.length)
    todays_num_jobs = todays_jobs.length

    //determine if we need to go to the next page
    if (todays_num_jobs == 10) {
        pageNum++
        start(pageNum)
    }

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