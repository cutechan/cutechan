package file

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"sync"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

var errNoConnection = fmt.Errorf("no connection to file backend")

type sftpBackend struct {
	client *sftp.Client
	sync.Mutex
	connect func() (*sftp.Client, error)
}

func (b *sftpBackend) IsServable() bool {
	return false
}

// Served by different server.
func (b *sftpBackend) Serve(w http.ResponseWriter, r *http.Request) {
	panic("non-servable backend")
}

func (b *sftpBackend) writeFile(fpath string, data []byte) error {
	if data == nil {
		return nil
	}

	b.Lock()
	defer b.Unlock()
	if b.client == nil {
		// TODO(Kagami): User will see upload error. Maybe we should wait some time, till SSH reconnects?
		return errNoConnection
	}

	dir := path.Dir(fpath)
	err := b.client.MkdirAll(dir)
	if err != nil {
		return err
	}

	file, err := b.client.OpenFile(fpath, fileCreationFlags)
	if os.IsExist(err) {
		// Ignore files already written by another thread or process
		// FIXME(Kagami): Doesn't work due to https://github.com/pkg/sftp/issues/242
		return nil
	}
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.ReadFrom(bytes.NewReader(data))
	return err
}

func getSFTPSourcePath(fileType uint8, sha1 string) string {
	return getImageURL(DefaultUploadsRoot, srcDir, fileType, sha1)
}

func getSFTPThumbPath(thumbType uint8, sha1 string) string {
	return getImageURL(DefaultUploadsRoot, thumbDir, thumbType, sha1)
}

func (b *sftpBackend) Write(sha1 string, fileType, thumbType uint8, src, thumb []byte) (err error) {
	// TODO(Kagami): Concurrent writes for faster upload?
	err = b.writeFile(getSFTPSourcePath(fileType, sha1), src)
	if err != nil {
		return
	}
	err = b.writeFile(getSFTPThumbPath(thumbType, sha1), thumb)
	return
}

func (b *sftpBackend) deleteFile(fpath string) error {
	b.Lock()
	defer b.Unlock()
	if b.client == nil {
		return errNoConnection
	}

	err := b.client.Remove(fpath)
	if os.IsNotExist(err) {
		// Ignore somehow absent files
		return nil
	}
	return err
}

func (b *sftpBackend) Delete(sha1 string, fileType, thumbType uint8) (err error) {
	err = b.deleteFile(getSFTPSourcePath(fileType, sha1))
	if err != nil {
		return
	}
	err = b.deleteFile(getSFTPThumbPath(thumbType, sha1))
	return
}

func connect(addr string, conf *ssh.ClientConfig) (*sftp.Client, error) {
	sshClient, err := ssh.Dial("tcp", addr, conf)
	if err != nil {
		return nil, fmt.Errorf("cannot connect to SFTP: %v", err)
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		return nil, fmt.Errorf("cannot connect to SFTP: %v", err)
	}

	return sftpClient, nil
}

func (b *sftpBackend) reconnect() {
	for {
		client, err := b.connect()
		if err == nil {
			b.Lock()
			b.client = client
			b.Unlock()
			break
		}
		log.Print(err)
		time.Sleep(time.Second * 5)
	}
}

func (b *sftpBackend) autoReconnect() {
	for {
		log.Printf("SFTP client connected")
		err := b.client.Wait()
		b.Lock()
		b.client = nil
		b.Unlock()
		log.Printf("SFTP client exited with %v, reconnecting...", err)
		b.reconnect()
	}
}

func sftpCreateDirs(client *sftp.Client) error {
	for _, dir := range [...]string{srcDir, thumbDir} {
		if err := client.MkdirAll(path.Join(DefaultUploadsRoot, dir)); err != nil {
			return err
		}
	}
	return nil
}

func makeSFTPBackend(conf Config) (fileBackend, error) {
	pubKey, _, _, _, err := ssh.ParseAuthorizedKey([]byte(conf.HostKey))
	if err != nil {
		return nil, fmt.Errorf("cannot parse SFTP public key: %v", err)
	}

	sshConf := &ssh.ClientConfig{
		User: conf.Username,
		Auth: []ssh.AuthMethod{
			ssh.Password(conf.Password),
		},
		HostKeyCallback: ssh.FixedHostKey(pubKey),
	}
	client, err := connect(conf.Address, sshConf)
	if err != nil {
		return nil, err
	}
	if err = sftpCreateDirs(client); err != nil {
		return nil, err
	}

	b := &sftpBackend{
		client: client,
		connect: func() (*sftp.Client, error) {
			return connect(conf.Address, sshConf)
		}}
	go b.autoReconnect()
	return b, nil
}
