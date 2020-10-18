import Map from "../DataTypes/Map"

/**
 * A representation of an in-game event
 */
export default class GameEvent {
	public type: string;
	public data: Map<any>;
	public time: number;

    constructor(type: string, data: Map<any> | Record<string, any> = null) {
        // Parse the game event data
        if (data === null) {
            this.data = new Map<any>();
        } else if (!(data instanceof Map)){
            // data is a raw object, unpack
            this.data = new Map<any>();
            for(let key in data){
                this.data.add(key, data[key]);
            }
        } else {
            this.data = data;
        }

        this.type = type;
        this.time = Date.now();
    }

    isType(type: string): boolean {
        return this.type === type;
    }

    toString(): string {
        return this.type + ": @" + this.time;
    }
}