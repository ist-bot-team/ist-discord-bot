// Typings for Fénix API interactions

export interface AboutInfo {
	institutionName: string;
	institutionUrl: string;
	rssFeeds: { description: string; url: string }[];
	currentAcademicTerm: string;
	languages: string[];
	language: string;
	rss: { [key: string]: string };
}

export interface ShortDegree {
	id: string;
	name: string;
	acronym: string;
	academicTerms: string[];
}

export interface FenixDegreeCourse {
	acronym: string;
	name: string;
	year: number;
	semester: number;
	announcementsFeedUrl?: string;
}

export interface RSSFeedItem {
	pubDate: string;
}

export interface RSSCourseAnnouncement extends RSSFeedItem {
	title: string;
	content: string;
	link: string;
	author: string;
}
