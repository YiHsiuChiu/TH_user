var noble = require('@abandonware/noble');
var mqtt = require('mqtt');
let Web3 = require('web3');
//const { Gpio } = require('onoff');
const express = require('express')
const SocketServer = require('ws').Server
//var open = require("open");
const exec = require('child_process').exec

const EthereumTx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const secp256k1 = require('secp256k1');
const publicKeyToAddress = require('ethereum-public-key-to-address')

var SerialPort = require('serialport');
var delay = require('delay');

//指定開啟的 port
const PORT = 3000

//創建 express 的物件，並綁定及監聽 3000 port ，且設定開啟後在 console 中提示
const server = express().listen(PORT, () => console.log(`Listening on ${PORT}`))

//將 express 交給 SocketServer 開啟 WebSocket 的服務
const wss = new SocketServer({ server })

//開啟前端ui
//1.
//open("./index.html",{app:'/usr/bin/chromium-browser'});

//2.
exec('chromium-browser --no-sandbox ./index.html');

//3.

//當 WebSocket 從外部連結時執行
wss.on('connection', ws => {
	console.log('Client connected')
	//ws.send('findBLEService')

	let mqttUrl = null;
	let topicGetInfo = null;
	let topicTxGW = null;
	let lotToken = null;
	let contractAbi = null;
	let contractAddr = null;

	let web3 = new Web3(new Web3.providers.WebsocketProvider("ws://211.75.159.144:8503"));

	noble.startScanningAsync(['12ab']);

	noble.on('discover', async (peripheral) => {
		ws.send('findBLEService');
		ws.send('step1');
		await noble.stopScanningAsync();
		console.log('---peripheral with ID ' + peripheral.id + ' found---');
		var advertisement = peripheral.advertisement;

		var localName = advertisement.localName;
		var txPowerLevel = advertisement.txPowerLevel;
		var manufacturerData = advertisement.manufacturerData;
		var serviceData = advertisement.serviceData;
		var serviceUuids = advertisement.serviceUuids;

		if (localName) {
			console.log('  Local Name        = ' + localName);
		}

		if (txPowerLevel) {
			console.log('  TX Power Level    = ' + txPowerLevel);
		}

		if (manufacturerData) {
			console.log('  Manufacturer Data = ' + manufacturerData.toString('hex'));
		}

		if (serviceData) {
			console.log('  Service Data      = ' + JSON.stringify(serviceData, null, 2));
		}

		if (serviceUuids) {
			console.log('  Service UUIDs     = ' + serviceUuids);
		}

		ws.on('message', data => {
			console.log(data);
			if (data == 'startParking')
				readCharacteristic(peripheral);
			else if (data == 'endParking') {
				peripheral.on('disconnect', async () => {
					var client = mqtt.connect(mqttUrl);
					client.on('connect', function () {
						console.log('---connect on mqtt---')
						client.subscribe('result', { qos: 1 });
					});
					client.on('message', async function (topic, message, packet) {
						console.log('get receipt:', message.toString());
						ws.send(message.toString());
					});
				});
				console.log('BLE disconnect');
				peripheral.disconnect();
			}
		})
	});

	const readCharacteristic = async (peripheral) => {
		await peripheral.connectAsync();
		console.log('---connect on BLE---');
		const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(['12ab'], ['34cd']);
		console.log('---find BLE characteristic---');
		var buf = Buffer.from('hi', 'utf8');
		await characteristics[0].write(buf);
		const data = (await characteristics[0].readAsync());
		console.log('  ' + data.toString());

		await parseLotJSON(JSON.parse(data.toString()));
	}

	const parseLotJSON = async (data) => {
		console.log('---get info---');
		mqttUrl = data.mqtt.url;
		console.log('  mqttUrl:', mqttUrl);
		topicGetInfo = data.mqtt.topic.getInfo;
		console.log('  topicGetInfo:', topicGetInfo);
		topicTxGW = data.mqtt.topic.TxGW;
		console.log('  topicTxGW:', topicTxGW);
		lotToken = data.contract.token;
		console.log('  lotToken:', lotToken);
		ws.send('step2');
		if (mqttUrl != null && topicGetInfo != null)
			await getContractInfo();
	}


	const getContractInfo = async => {
		var client = mqtt.connect(mqttUrl);
		let data;
		client.on('connect', function () {
			console.log('---connect on mqtt---')
			client.subscribe(topicGetInfo, { qos: 1 });
		});
		client.on('message', async function (topic, message, packet) {
			console.log('---subscribe getInfo topic---')
			data = JSON.parse(message.toString());
			console.log('  ' + data);
			client.end();
			await parseMQTTJSON(data);
		});
	}

	const parseMQTTJSON = async (data) => {
		console.log('---get info---');
		contractAbi = data.abi;
		//console.log('  contractAbi:',contractAbi);	
		contractAddr = data.addr;
		console.log('  contractAddr:', contractAddr);
		ws.send('step3');
		await signTx();
	}

	const signTx = async => {
		var contract = new web3.eth.Contract(contractAbi);
		//contract.options.address = contractAddr;
		console.log('---connect on eth node---');
		let to = contractAddr;

		var port = new SerialPort('/dev/ttyACM0', {
			baudRate: 115200
		});


		let buff = 'set';
		let tx;
		let signedData = '';
		let hashedTx;
		let publicKey = '';
		let chainId = 27596;
		var r = "0x";
		var s = "0x";
		var v;

		port.on('open', async function () {
			console.log('COM open')
			port.write('$H_#', function (err) {
				if (err) {
					return console.log('Error on write: ', err.message);
				}
				console.log('message written on COM:', '$H_#');
			});
			port.on('data', async function (data) {
				buff += data.toString();
				//取得地址、產生tx
				if(buff.match(/#/ig)==null){
				
				}
				else if (buff.match(/#/ig).length >= 1 && publicKey == '') {
					start = buff.search(/\$4_/) + 3;
					publicKey = buff.substring(start, start + 128);
					console.log('publicKey:', publicKey);
					let account = publicKeyToAddress('04' + publicKey);
					console.log("Addr:", account);
					await web3.eth.getTransactionCount(account).then(txCount => {
						let newNonce = web3.utils.toHex(txCount);
						web3.eth.getGasPrice().then(async (gasPrice) => {
							const sdata = contract.methods.ParkingWithETH(lotToken).encodeABI(function (error, result) {
								if (!error)
									console.log(result);
								else
									console.error(error)
							});
							console.log("  encoded ABI:", sdata)

							let txParams = {
								nonce: newNonce,
								gasPrice: parseInt(gasPrice),
								gas: '0xF4240',
								from: account,
								to: to,
								value: '0xDE0B6B3A7640000',
								data: sdata,
							}
							console.log("  txParams:", txParams);


							const customCommon = Common.forCustomChain(
								'mainnet',
								{
									chainId: chainId,
									networkId: chainId,
								},
								'petersburg',
							)

							tx = new EthereumTx(txParams, { common: customCommon })
							hashedTx = tx.hash(false);
							console.log('hashedTx:', hashedTx.toString('hex'));
							await delay(500);
							buff = 'reset';
							port.write('$2_' + hashedTx.toString('hex') + '#', function (err) {
								if (err) {
									return console.log('Error on write: ', err.message);
								}
								console.log('message written on COM:', '$2_' + hashedTx.toString('hex') + '#');
							});
							await delay(500);
							port.write('$0_#', function (err) {
								if (err) {
									return console.log('Error on write: ', err.message);
								}
								console.log('message written on COM:', '$0_#');
							});
						})
					})
				}
				//sign
				else if (buff.match(/#/ig).length >= 5) {
					let start = buff.search(/\$3_/) + 3;
					signedData = buff.substring(start, start + 128);
					// console.log(buff)
					console.log('signedData:', signedData);

					r += signedData.substring(0, 64);
					s += signedData.substring(64, 128);
					v = chainId * 2 + 35;

					let recoverPubkey = Buffer.from(secp256k1.ecdsaRecover(Buffer.from(signedData, "hex"), 1, hashedTx, false)).toString('hex')
					if (recoverPubkey == '04' + publicKey.toLowerCase())
						v += 1

					tx.r = r;
					tx.s = s;
					tx.v = v;

					// from: '0xfccBFe26448d3Ea0739084cD09ce286189CC2cd2'
					console.log('Senders Address: ' + tx.getSenderAddress().toString('hex'))

					let raw = tx.serialize().toString('hex');
					console.log('raw:', raw);

					port.close(function () {
						console.log('COM closed');
						sendRaw(raw);
					});
				}
			})
		})
	}

	const sendRaw = async raw => {
		ws.send('step4');
		let rawData = {
			"raw": "0x" + raw,
			"token": lotToken,
		}
		//web3.eth.sendSignedTransaction(signedTx.raw);
		var client = mqtt.connect(mqttUrl);
		client.on('connect', function () {
			console.log('---connect on mqtt---')
			client.subscribe('lot/tradeState', { qos: 1 })
			client.publish(topicTxGW, JSON.stringify(rawData), { qos: 1 });
			console.log("raw sent!");
			ws.send('step5');
		});
		client.on('message', async function (topic, message, packet) {
			data = message.toString();
			console.log('get tradeState:', data);
			if (JSON.parse(data).message == "success") {
				console.log('success');
				ws.send('step6-1');
				client.end();
			} else if (JSON.parse(data).message == "fail") {
				console.log('fail');
				ws.send('step6-2');
				client.end();
			}
		});
	}

	//當 WebSocket 的連線關閉時執行
	ws.on('close', () => {
		console.log('Close connected');
		process.exit(0);
	})
})
