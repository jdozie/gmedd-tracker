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
const url_prefix = "https://careers.gamestop.com";
const url = "https://careers.gamestop.com/en-US/search?orderby=-date";
//const url_prefix = "https://gamestop-careers.jobs.net";
//const url = "https://gamestop-careers.jobs.net/en-US/search?orderby=-date";
const gmedd_report_model_url = "https://gmedd.com/report-model/";

//global variables
var today = "";
var todays_num_jobs = 0;
var todays_jobs = [];
var todays_filings = [];
var todays_news_releases = [];

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
            
            case 'gsnews': 
                //fetch the data
                await get_the_news();
                if (todays_news_releases.length == 0) {
                    let news_embed = new Discord.MessageEmbed()
                    .setTitle(`${today} News Releases`)
                    .attachFiles(logoattachment)
                    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
                    .setColor('#242424')
                    .setThumbnail('attachment://logo.png')
                    .setTimestamp()
                    .setFooter('Based on public data available on gamestop.com', client.user.avatarURL())
                    .setDescription('No news releases available today.');
                    msg.channel.send(news_embed);
                }
                else {
                    display_news_releases(msg, todays_news_releases, logoattachment);
                }
                break;

            case 'filings': 
                await get_the_filings();
                if (todays_filings.length == 0) {
                    let filings_embed = new Discord.MessageEmbed()
                    .setTitle(`SEC Filings`)
                    .attachFiles(logoattachment)
                    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
                    .setColor('#242424')
                    .setThumbnail('attachment://logo.png')
                    .setTimestamp()
                    .setFooter('Based on public data available on gamestop.com', client.user.avatarURL())
                    .setDescription('No SEC Filings available today.');
                    msg.channel.send(filings_embed);
                }
                else {
                    display_sec_filings(msg, logoattachment);
                }
                break;

            case 'hires':
                var hires = await get_the_hires();
                display_the_hires(msg, hires, logoattachment);
                break;

            case 'press':
                var press = await get_the_press();
                display_the_press(msg, press, logoattachment);
                break;

            case 'model':
                var model = await get_the_model();
                display_the_model(msg, model, logoattachment);
                break;

            case 'report': 
                var report = await get_the_report();
                display_the_report(msg, report, logoattachment);
                break;

            case 'products':
                //msg.channel.send(await get_the_products("https://www.gamestop.com/search/?q=all"));
                break;

            case 'orders':
                var order_form = await get_the_order_form();
                display_the_order_form(msg, order_form, logoattachment);
                break;

            case 'test':
                await load_careers_site();
                break;

            case 'commands':
                display_the_help(msg, logoattachment);
                break;
         }
     }
});

client.login(token);


function display_todays_jobs(channel, logoattachment) {
    //build embed properties
    let embed = new Discord.MessageEmbed()
    .setTitle(`${today} Career Postings`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .setFooter('Based on public data available on gamestop.com', client.user.avatarURL());

    if (todays_num_jobs == 50) {
        embed.setDescription(`GameStop posted at least **${todays_num_jobs}** new jobs today. Here are the first 15.`)
    }
    else if (todays_num_jobs > 15) {
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
                    { name: `⠀`, value: `[${job.title}](${job.link})\n`+city_state_formatter(job)}    
                );  
            }    
        }
        else {
            for (var i = 0; i < todays_jobs.length; i++) {
                var job = todays_jobs[i];
                embed.addFields(
                    { name: `⠀`, value: `[${job.title}](${job.link})\n`+city_state_formatter(job)}    
                );  
            }    
        }
    
    }

    //send embedded response
    channel.send(embed)
            //.then(console.log)
            .catch(console.error);        

}


function display_sec_filings(msg, logoattachment) {
    //build embed properties
    let sec_embed = new Discord.MessageEmbed()
        .setTitle(`GameStop SEC Filings`)
        .attachFiles(logoattachment)
        .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
        .setColor('#242424')
        .setThumbnail('attachment://logo.png')
        .setTimestamp()
        .setFooter('Based on public data available on gamestop.com', client.user.avatarURL());

    //list each individual sec filing in the embed
    for (var i = 0; i < todays_filings.length; i++) {
        var filing = todays_filings[i];
        sec_embed.addFields(
            { name: filing.date + " Form " + filing.form_num, value: filing.filing_link},
            { name: "Description: ", value: filing.description, inline: true},
            { name: "Filing Group: ", value: filing.filing_group, inline: true}  
        )  
    }
    msg.channel.send(sec_embed);
}

function display_news_releases(msg, news, logoattachment) {
    //build embed properties
    let news_embed = new Discord.MessageEmbed()
    .setTitle(`${today} GameStop News Releases`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .setFooter('Based on public data available on gamestop.com', client.user.avatarURL());
    
    for (var i=0; i < news.length; i++) { 
        var pr = news[i];
        news_embed.addFields(
            { name: `**${pr.headline}**`, value: pr.link}
        )
    }
    msg.channel.send(news_embed);
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

function display_the_press(msg, press, logoattachment) {
    //build embed properties
    let press_embed = new Discord.MessageEmbed()
    .setTitle(`Ryan Cohen Press`)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .setDescription(`Links to various media appearances by Ryan Cohen (articles, video interviews).`)
    .addField('⠀', press);
    msg.channel.send(press_embed);
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

function display_the_products(msg, products, logoattachment) {
    //build embed properties
    let products_embed = new Discord.MessageEmbed()
    .setTitle(`GameStop.com Available Products: `)
    .attachFiles(logoattachment)
    .setAuthor(`GMEdd.com`, null, 'https://GMEdd.com')
    .setColor('#242424')
    .setThumbnail('attachment://logo.png')
    .setTimestamp()
    .addField('Total: ', products.all)
    .setFooter('Based on public data available on gamestop.com', client.user.avatarURL());
    msg.channel.send(products_embed);
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
        {name: `**/press**`, value: `Returns link to the Ryan Cohen Press spreadsheet from [GMEdd](GMEdd.com)`},
        {name: `**/model**`, value: `Returns link to the current [GMEdd](GMEdd.com) GameStop financial model`},
        {name: `**/report**`, value: `Returns link to the [GMEdd](GMEdd.com) GameStop Research Report`},
        {name: `**/orders**`, value: `Returns link to the GMEdd GameStop Order Form`}
        //{name: `**!products**`, value: `Returns the total amount of available products on gamestop.com`}
    );
    msg.channel.send(embed);
}

//direct link to linkedin hires spreadsheet from gmedd.com
async function get_the_hires() {
    return "https://gmedd.com/hires";
}

//direct link to rc press spreadsheet from gmedd.com
async function get_the_press() {
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

//checks for any new news releases on gamestop's website
async function get_the_news() {
    const news_releases_url = "https://news.gamestop.com/news-releases-0";
    const response = await got(news_releases_url);
    const dom = new JSDOM(response.body);

    const news_release_prefix = "https://news.gamestop.com";

    var div_panels = dom.window.document.getElementsByClassName("panel");
    var news_releases = [];
    for (var i=0; i<div_panels.length; i++) {
        var element = div_panels[i];
        var link = element.querySelectorAll('span a')[1];
        var date_posted = element.querySelector('span div div').textContent.replace(/\s\s+/g, ' ');
        var headline = link.textContent;

        var parsed_date = date_posted.split("/");
        var month = parsed_date[0].trim();
        if (month.charAt(0) == '0') {
            month = month.substr(1);
        }
        var day = parsed_date[1].trim();
        if (day.charAt(0) == '0') {
            day = day.substr(1);
        }
        var year = "20" + parsed_date[2].trim();
        var readable_date = {"month": month, "day": day, "year": year};
        var news_release = {'headline': headline, 'date': date_posted, 'link': news_release_prefix + link.href, 'readable_date': readable_date};
        news_releases.push(news_release);
    }
    const todays_date = get_todays_date();
    //console.log(todays_date);
    //console.log(news_releases);
    todays_news_releases = news_releases.filter(news => was_posted_today(news, todays_date));
    //console.log(todays_news_releases);

    return news_releases;
}

//checks the table on GameStop's website where SEC filings are listed
async function get_the_filings() {
    const filings_url = "https://news.gamestop.com/financial-information/sec-filings";
    const response = await got(filings_url);
    const dom = new JSDOM(response.body);

    var table = dom.window.document.getElementsByTagName("table")[0];
    var filings = [];
    for (var i=1; i<table.rows.length; i++) {
        //get current row 
        var tabletr = table.rows[i];

        //get first td element (date)
        var date = tabletr.cells[0].textContent.replace(/\s\s+/g, ' ');

        var parsed_date = date.split("/");
        var month = parsed_date[0].trim();
        if (month.charAt(0) == '0') {
            month = month.substr(1);
        }
        var day = parsed_date[1].trim();
        if (day.charAt(0) == '0') {
            day = day.substr(1);
        }
        var year = "20" + parsed_date[2].trim();
        var readable_date = {"month": month, "day": day, "year": year};

        //get second td element (form number)
        var form_num = tabletr.cells[1].textContent.replace(/\s\s+/g, ' ');

        //get third td element (description)
        var description = tabletr.cells[2].textContent.replace(/\s\s+/g, ' ');

        //get fourth td element (filing group)
        var filing_group = tabletr.cells[3].textContent.replace(/\s\s+/g, ' ');

        //get fifth td element (filing links)
        var filing_link = tabletr.cells[4].querySelector("div span a").href;

        var sec_filing = {"date": date, "form_num": form_num, "description": description, "filing_group": filing_group, "filing_link": filing_link, "readable_date": readable_date};
        filings.push(sec_filing);
    }

    const todays_date = get_todays_date();
    //console.log(todays_date);
    //console.log(filings);
    todays_filings = filings.filter(filing => was_posted_today(filing, todays_date));
}

//TEST
async function load_careers_site() {
    //launch
    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    //if any unhandled promise rejections are encountered, exit the browser
    process.on('unhandledRejection', (reason, p) => {
        console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
        browser.close();
      });

    if (pageNum > 10) {
        //no need to travel further than this
        browser.close()
        exit()
    }
    
    //request careers webpage
    var url = 'https://careers.gamestop.com/us/en/search-results?keywords='
    const careersPage = url.concat('&from=', parseInt((pageNum * 10) - 10))
    console.log(careersPage)
    
    await page.goto(careersPage)
    //filter by most recent and make sure it loads
    page.waitForSelector('#sortselect')
    await page.select('#sortselect', 'Most recent')
    //screenshot
    await page.screenshot({path: 'current-listings-page'+parseInt(pageNum)+'.png', fullPage: true})
    todays_jobs = []
    
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
    fs.writeFile('jobs.txt', JSON.stringify(jobs, null, 2), {flag: "a+"})

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
                return 'Spreadsheet updated successfully!'
            }
            return 'Something went wrong updating the spreadsheet :( '
        } catch(e) {
            console.log('Error updating spreadsheet', e)
        }
    }

    //determine if we need to go to the next page
    if (todays_jobs == 10) {
        pageNum++
        start(pageNum)
    }

    //close browser
    await browser.close()
}


//note: only grabs first page of listings (max. 50 postings)
// async function get_the_jobs() { 
//     const response = await got(url);
//     const dom = new JSDOM(response.body);

//     var table = dom.window.document.getElementsByTagName("table")[0];
//     var jobs = [];
//     for (var i=1; i<table.rows.length; i++) {
//         //get current row
//         var tabletr = table.rows[i];
        
//         //get first td element which is job title
//         var title = tabletr.cells[0];

//         //get hyperlink to job posting 
//         var link = url_prefix + title.querySelector("a").href;

//         //get third td element which is job location
//         var location = tabletr.cells[2].textContent;

//         var stripped_location = location.replace(/\s\s+/g, ' ');
//         var num_index = stripped_location.search(/\d/);

//         var city_state = stripped_location.substring(0, num_index).trim();
//         var address = stripped_location.substring(num_index, stripped_location.length).trim();

//         //get fourth td element which is date posted
//         var date = tabletr.cells[3].textContent.replace(/\s\s+/g, ' ');
//         console.log('date: ' + date);
        
//         var date_pieces = date.split('/');
//         var month = date_pieces[0].trim();
//         var day = date_pieces[1].trim();
//         var year = date_pieces[2].trim();
//         var readable_date = {'month': month, 'day': day, 'year': year};

//         jobs.push({'title': title.textContent.replace(/\s\s+/g, ' ').trim(), 'link': link, 'address': address, 'city_state': city_state, 'readable_date': readable_date});
//     }

//     const todays_date = get_todays_date();
//     //console.log('todays date: ', todays_date);

//     todays_jobs = jobs.filter(job => was_posted_today(job, todays_date));

//     //console.log(todays_jobs);
//     todays_num_jobs = todays_jobs.length;
//     //fs.writeFileSync('./'+today.month+'-'+today.day+'-'+today.year+'_listings.json', JSON.stringify(todays_jobs, null, 2) , 'utf-8');
// }

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

//if city_state is undefined, return an empty string. else, return city_state string value
function city_state_formatter(job) {
    return job.address + " " + (job.city_state != 'undefined' ? job.city_state : " ");
}

//will send a .json of the current job listings. currently unused
// function sendFiles(channelID, fileArr, interval) {
// 	var resArr = [], len = fileArr.length;
// 	var callback = typeof(arguments[2]) === 'function' ? arguments[2] : arguments[3];
// 	if (typeof(interval) !== 'number') interval = 1000;

// 	function _sendFiles() {
// 		setTimeout(function() {
// 			if (fileArr[0]) {
// 				bot.uploadFile({
// 					to: channelID,
// 					file: fileArr.shift()
// 				}, function(err, res) {
// 					resArr.push(err || res);
// 					if (resArr.length === len) if (typeof(callback) === 'function') callback(resArr);
// 				});
// 				_sendFiles();
// 			}
// 		}, interval);
// 	}
// 	_sendFiles();
// }