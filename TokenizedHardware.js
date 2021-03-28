var SerialPort = require('serialport');
var delay = require('delay');

class tokenizedHardware{
    getPubKey(portName){
        var buff;

        var port = new SerialPort(portName, {
			baudRate: 115200
		});

        port.on('open', async function () {
			port.write('$H_#', function (err) {
				if (err) {
					return console.log('Error on write: ', err.message);
				}
                buff ='';
				console.log('message written on COM:', '$H_#');
			});
            port.on('data', async function (data) {
				buff += data.toString();
				//取得地址、產生tx
				if(buff.match(/#/ig)==null){
				
				}
				else if (buff.match(/#/ig).length >= 1) {
					start = buff.search(/\$4_/) + 3;
					publicKey = buff.substring(start, start + 128);
                    port.close();
					return publicKey;
                }
            }) 
        })
    }

    sign(signData,portName){
        var buff;

        var port = new SerialPort(portName, {
			baudRate: 115200
		});

        port.on('open', async function () {
            port.write('$2_' + signData + '#', function (err) {
                if (err) {
                    return console.log('Error on write: ', err.message);
                }
                buff ='';
                console.log('message written on COM:', '$2_' + hashedTx.toString('hex') + '#');
            });
            await delay(500);
            port.write('$0_#', function (err) {
                if (err) {
                    return console.log('Error on write: ', err.message);
                }
                console.log('message written on COM:', '$0_#');
            });
            port.on('data', async function (data) {
                buff += data.toString();

				if(buff.match(/#/ig)==null){
				
				}
                else if (buff.match(/#/ig).length >= 5) {
					let start = buff.search(/\$3_/) + 3;
					signedData = buff.substring(start, start + 128);
					port.close();
                    return signedData;
				}
            }) 
        })
    }
}

module.exports = tokenizedHardware;