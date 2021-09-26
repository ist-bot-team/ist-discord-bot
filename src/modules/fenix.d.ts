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
