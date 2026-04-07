declare module 'lunar-javascript' {
    export class Solar {
        static fromYmd(year: number, month: number, day: number): Solar
        getLunar(): Lunar
        getYear(): number
        getMonth(): number
        getDay(): number
    }

    export class Lunar {
        getMonthInChinese(): string
        getDayInChinese(): string
        getFestivals(): string[]
        getJieQi(): string | null
        getDay(): number
    }
}
